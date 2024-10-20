import json
import boto3
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
retries_table = dynamodb.Table('DeviceFirmwareRetries')
iot = boto3.client('iot')

def handler(event, context):
    device_id = event['deviceId']
    
    if not device_id:
        return {
            'statusCode': 400,
            'deviceId': device_id,
            'restore_time': None,
            'message': 'deviceId is required'
        }
    
    try:
        # Reset retry count and increment reset retry counter
        response = retries_table.update_item(
            Key={'deviceId': device_id},
            UpdateExpression='SET RetryCounter = :val, ResetRetryCount = ResetRetryCount + :inc',
            ExpressionAttributeValues={
                ':val': 0,
                ':inc': 1
            },
            ReturnValues='UPDATED_NEW'
        )
        
        # Change the device attributes to "moveOut"
        update_device_attributes(device_id, "moveOut", "moveOut")
        
        logger.info(f"Device {device_id} attributes updated to 'moveOut' and retry count reset.")
        
        # Calculate the restore time (24 hours later)
        restore_time = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        return {
            'statusCode': 200,
            'deviceId': device_id,
            'restore_time': restore_time
        }
    except Exception as e:
        logger.error(f"Error in ResetRetryCountAndMoveOut for device {device_id}: {str(e)}")
        return {
            'statusCode': 500,
            'deviceId': device_id,
            'restore_time': None,
            'message': f"Error in ResetRetryCountAndMoveOut for device {device_id}: {str(e)}"
        }

def update_device_attributes(device_id, model, FW):
    iot.update_thing(
        thingName=device_id,
        attributePayload={
            'attributes': {
                'model': model,
                'FW': FW
            },
            'merge': True
        }
    )