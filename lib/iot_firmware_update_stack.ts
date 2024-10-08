import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as fs from 'fs';
import * as path from 'path';
import * as custom_resources from 'aws-cdk-lib/custom-resources';

export class IotFirmwareUpdateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Environment variables
    const accountNumber = process.env.CDK_DEFAULT_ACCOUNT;
    const region = process.env.CDK_DEFAULT_REGION;

    if (!accountNumber || !region) {
      throw new Error("Both CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION environment variables need to be set");
    }
    
    // DynamoDB Tables
    const deviceAttributeBackupTable = new dynamodb.Table(this, 'DeviceAttributeBackup', {
      tableName: 'DeviceAttributeBackup',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      readCapacity: 5,
      writeCapacity: 5,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const deviceFirmwareRetriesTable = new dynamodb.Table(this, 'DeviceFirmwareRetries', {
      tableName: 'DeviceFirmwareRetries',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      readCapacity: 5,
      writeCapacity: 5,
       removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Lambda Functions
    const lambdaPath = path.join(__dirname, 'lambda');

    const checkIfDeviceExistsLambda = new lambda.Function(this, 'CheckIfDeviceExistsLambda', {
      functionName: 'CheckIfDeviceExists',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'CheckIfDeviceExists.handler',
      environment: {
        DEVICE_FIRMWARE_RETRIES_TABLE: deviceFirmwareRetriesTable.tableName
      }
    });

    const storeDeviceAttributesLambda = new lambda.Function(this, 'StoreDeviceAttributesLamba', {
      functionName: 'StoreDeviceAttributes',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'StoreDeviceAttributes.handler',
      environment: {
        DEVICE_ATTRIBUTE_BACKUP_TABLE: deviceAttributeBackupTable.tableName
      }
    });

    const createDeviceRecordLambda = new lambda.Function(this, 'CreateDeviceRecordLambda', {
      functionName: 'CreateDeviceRecord',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'CreateDeviceRecord.handler',
      environment: {
        DEVICE_FIRMWARE_RETRIES_TABLE: deviceFirmwareRetriesTable.tableName,
        DEVICE_ATTRIBUTE_BACKUP_TABLE: deviceAttributeBackupTable.tableName
      }
    });


    const incrementRetryCounterLambda = new lambda.Function(this, 'IncrementRetryCounterLambda', {
      functionName: 'IncrementRetryCounter',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'IncrementRetryCounter.handler',
      environment: {
        DEVICE_FIRMWARE_RETRIES_TABLE: deviceFirmwareRetriesTable.tableName
      }
    });

    const resetRetryCountAndMoveOutLambda = new lambda.Function(this, 'ResetRetryCountAndMoveOutLambda', {
      functionName: 'ResetRetryCountAndMoveOut',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'ResetRetryCountAndMoveOut.handler',
      environment: {
        DEVICE_FIRMWARE_RETRIES_TABLE: deviceFirmwareRetriesTable.tableName
      }
    });

    const restoreDeviceAttributesLambda = new lambda.Function(this, 'RestoreDeviceAttributesLambda', {
      functionName: 'RestoreDeviceAttributes',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'RestoreDeviceAttributes.handler',
      environment: {
        DEVICE_ATTRIBUTE_BACKUP_TABLE: deviceAttributeBackupTable.tableName
      }
    });
    
    const resetRetryCountToFailedUpdateLambda = new lambda.Function(this, 'ResetRetryCountToFailedUpdate', {
      functionName: 'ResetRetryCountToFailedUpdate',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'ResetRetryCountToFailedUpdate.handler',
      environment: {
        DEVICE_FIRMWARE_RETRIES_TABLE: deviceFirmwareRetriesTable.tableName
      }
    });

    const moveDeviceToFailedGroupLambda = new lambda.Function(this, 'MoveDeviceToFailedGroupLambda', {
      functionName: 'MoveDeviceToFailedGroup',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'MoveDeviceToFailedGroup.handler',
      environment: {
        ACCOUNT_NUMBER: accountNumber
      }
    });
    
        // Construct SNS Topic
    const FailedFirmwareUpdateSnsTopic = new sns.Topic(this, 'FailedFirmwareUpdateSnsTopic', {
      displayName: 'FailedFirmwareUpdate',
      topicName: 'FailedFirmwareUpdate.fifo',
      fifo: true,
      contentBasedDeduplication: true,
    });
    
    const sendSNSNotificationLambda = new lambda.Function(this, 'SendSNSNotificationLambda', {
      functionName: 'SendSNSNotification',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'SendSNSNotification.handler',
      environment: {
        ACCOUNT_NUMBER: accountNumber
      }
    });

    // Create IoT Thing Group
    new iot.CfnThingGroup(this, 'FailedToUpdate', {
      thingGroupName: 'FailedToUpdate'
    });

    // Grant DynamoDB table access to Lambda functions
    deviceFirmwareRetriesTable.grantReadWriteData(checkIfDeviceExistsLambda);
    deviceFirmwareRetriesTable.grantReadWriteData(createDeviceRecordLambda);
    deviceFirmwareRetriesTable.grantReadWriteData(incrementRetryCounterLambda);
    deviceFirmwareRetriesTable.grantReadWriteData(resetRetryCountAndMoveOutLambda);
    deviceFirmwareRetriesTable.grantReadWriteData(resetRetryCountToFailedUpdateLambda);
    deviceAttributeBackupTable.grantReadWriteData(storeDeviceAttributesLambda);
    deviceAttributeBackupTable.grantReadWriteData(restoreDeviceAttributesLambda);
    
      
    FailedFirmwareUpdateSnsTopic.grantPublish(sendSNSNotificationLambda);

    // IAM Role for IoT Core Operations
    const iotRole = new iam.Role(this, 'IoTRole',{
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com')
    });
        
     // Add IoT Permissions
    iotRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iot:AddThingToThingGroup',
        'iot:RemoveThingFromThingGroup',
        'iot:UpdateThing'
      ],
      resources: [
        `arn:aws:iot:${region}:${accountNumber}:thinggroup/*`,
        `arn:aws:iot:${region}:${accountNumber}:thing/*`
      ]
    }));
    

    // IAM Role for Step Functions and IoT Core to invoke Lambda functions
    const stepFunctionsInvokeRole = new iam.Role(this, 'StepFunctionsInvokeRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('states.amazonaws.com'),
        new iam.ServicePrincipal('iot.amazonaws.com')
      )
    });

    // Grant the role permissions to invoke Lambda functions
    checkIfDeviceExistsLambda.grantInvoke(stepFunctionsInvokeRole);
    storeDeviceAttributesLambda.grantInvoke(stepFunctionsInvokeRole);
    createDeviceRecordLambda.grantInvoke(stepFunctionsInvokeRole);
    incrementRetryCounterLambda.grantInvoke(stepFunctionsInvokeRole);
    resetRetryCountAndMoveOutLambda.grantInvoke(stepFunctionsInvokeRole);
    restoreDeviceAttributesLambda.grantInvoke(stepFunctionsInvokeRole);
    resetRetryCountToFailedUpdateLambda.grantInvoke(stepFunctionsInvokeRole);
    moveDeviceToFailedGroupLambda.grantInvoke(stepFunctionsInvokeRole);
    sendSNSNotificationLambda.grantInvoke(stepFunctionsInvokeRole);
    
    resetRetryCountAndMoveOutLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions:[
        'iot:AddThingToThingGroup',
        'iot:UpdateThing',
        'iot:RemoveThingFromThingGroup'
      ],
      resources: [
        `arn:aws:iot:${region}:${accountNumber}:thinggroup/*`,
        `arn:aws:iot:${region}:${accountNumber}:thing/*`
      ]
    }));
    
    resetRetryCountToFailedUpdateLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions:[
        'iot:AddThingToThingGroup',
        'iot:UpdateThing',
        'iot:RemoveThingFromThingGroup'
      ],
      resources: [
        `arn:aws:iot:${region}:${accountNumber}:thinggroup/*`,
        `arn:aws:iot:${region}:${accountNumber}:thing/*`
      ]
    }));
    
    moveDeviceToFailedGroupLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions:[
        'iot:AddThingToThingGroup',
        'iot:UpdateThing',
        'iot:RemoveThingFromThingGroup'
      ],
      resources: [
        `arn:aws:iot:${region}:${accountNumber}:thinggroup/*`,
        `arn:aws:iot:${region}:${accountNumber}:thing/*`
      ]
    }));
    
    restoreDeviceAttributesLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions:[
        'iot:AddThingToThingGroup',
        'iot:UpdateThing',
        'iot:RemoveThingFromThingGroup'
      ],
      resources: [
        `arn:aws:iot:${region}:${accountNumber}:thinggroup/*`,
        `arn:aws:iot:${region}:${accountNumber}:thing/*`
      ]
    }));
    
    const iotRulesRole = new iam.Role(this, 'IotRulesRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com')
    });
    
    iotRulesRole.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      'states:StartExecution',
      'logs:CreateLogStream',
      'logs:PutLogEvents'
    ],
    resources: [
      `arn:aws:states:${region}:${accountNumber}:stateMachine:FirmwareUpdateStateMachine`,
      `arn:aws:logs:${region}:${accountNumber}:log-group:/aws/iot/*`
      ],
    }));
    

    // Wait Lambda Function
    const waitLambda = new lambda.Function(this, 'WaitLambda', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'wait_for_propagation.handler',
      timeout: cdk.Duration.seconds(250)
    });

    const waitProvider = new custom_resources.Provider(this, 'WaitProvider', {
      onEventHandler: waitLambda,
    });

    const waitForPropagation = new cdk.CustomResource(this, 'WaitForPropagation', {
      serviceToken: waitProvider.serviceToken,
    });

    waitForPropagation.node.addDependency(stepFunctionsInvokeRole);
    waitForPropagation.node.addDependency(iotRole);
    waitForPropagation.node.addDependency(iotRulesRole);

    // Load state machine definition
    const stateMachineDefinition = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../resources/statemachine-definition.json'), 'utf8')
    );

    // Replace placeholders in the state machine definition
    const updatedStateMachineDefinition = JSON.stringify(stateMachineDefinition)
      .replace(/\${AccountNumber}/g, accountNumber)
      .replace(/\${Region}/g, region)
      .replace(/\${SNS_TOPIC_ARN}/g, FailedFirmwareUpdateSnsTopic.topicArn);

    // Create State Machine
    const stateMachine = new stepfunctions.CfnStateMachine(this, 'FirmwareUpdateStateMachine', {
      stateMachineName: 'FirmwareUpdateStateMachine',
      definitionString: updatedStateMachineDefinition,
      roleArn: stepFunctionsInvokeRole.roleArn
    });

    // Create IoT Rule
    new iot.CfnTopicRule(this, 'FailedFirmwareUpdateRule', {
      ruleName: 'FailedFirmwareUpdateRule',
      topicRulePayload: {
        sql: "SELECT * FROM 'iot/device/data' WHERE status = 'failed'",
        actions: [
          {
            cloudwatchLogs: {
              roleArn: `arn:aws:iam::${accountNumber}:role/IoTCloudWatchLoggingRole`,
              logGroupName: 'iot_failed_updates'
            }
          },
          {
            stepFunctions: {
              stateMachineName: 'FirmwareUpdateStateMachine',
              roleArn: iotRulesRole.roleArn
            }
          }
        ]
      }
    });  


    // CloudWatch Log Group
    new logs.LogGroup(this, 'IoTFailedUpdatesLogGroup', {
      logGroupName: 'iot_failed_updates',
       removalPolicy: cdk.RemovalPolicy.DESTROY
    });
  }
}