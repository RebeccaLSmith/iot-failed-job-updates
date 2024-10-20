
- **[LinkedIn: Rebecca Smith](https://www.linkedin.com/in/rebecca-smith101/)**
# iot-firmware-update

This project deploys an AWS CDK stack for managing IoT firmware updates and handling failures. The solution includes several AWS services such as Lambda functions, DynamoDB tables, Step Functions, and IoT rules to create a robust workflow for handling firmware update processes for IoT devices.

## Solution Overview

The solution orchestrates the process of updating IoT device firmware currently leveraging IoT Continous Jobs with DynamicThingGroups and managing any failures that may occur. IoT Jobs has a hard retry limit of 10. Sometimes intermitent connectivity can cause a device to get stuck in a DynamicThingGroup when updating a device due to the hard limit in Continous Job Retries. With this solution devices sending data into IoT Core are routed using IoT Rules on the topic iot/device/data for 'failed' status. Rules trigger logging in Cloudwatch to record the error and starts a step function workflow. Deivce attributes are stored in a DynamoDB table, and retires are recorded in a second table. Once a device reaches the retry limit of 10 the attributes are dynamically changed, the retry counter is reset to zero and the reset count is recorded as 1. This change causes the device to be removed from the DynamicThingGroup and reseets the hard limit in Continous Jobs to 0. After a period of time, 24 hours in this case, the device attirbutes are restored causing the device to be dynamically added back to the DynamicThingGroup and Continous Job Updates are resumed. If a device cycles through 10 retries a second time, the device attributes are changed, causing the device to once again be dynamically removed from the DynamicThingGroup. The device is then added to a StaticThingGroup and an SNS notification is sent to notify the need for manual intervention. 

## Architecture

![Architecture](/resources/Architecture/FirmwareUpdateRetries.png)

It includes the following key components:

### Lambda Functions

The solution uses several Lambda functions, each performing a specific role in the firmware update process:

- `CheckIfDeviceExists`: Checks if a device record exists in the DynamoDB table.
- `StoreDeviceAttributes`: Stores original device attributes in the backup table if they don't already exist.
- `CreateDeviceRecord`: Creates a new record for the device in the second DynamoDB table to record retries.
- `IncrementRetryCounter`: Increments the retry counter for firmware updates.
- `ResetRetryCounterAndMoveOut`: Resets the retry counter and changes the device attirbutes.
- `RestoreDeviceAttributes`: Restores the original device attributes from the backup table.
- `ResetRetryCountToFailedUpdate`: Resets retry counter to 0, updates reset counter to 2 and changes device attributes.
- `MoveDeviceToFailedGroup`: Moves a device to a "failed" group.
- `SendSNSNotification`: Sends an SNS notification if required.

### Step Functions

The state machine orchestrates the workflow for handling firmware update failures, ensuring that each step is completed successfully or appropriately handled if an error occurs.

### DynamoDB Tables

Two DynamoDB tables are used. If you do not want to destroy these resources upon destroying the CDK stack, remove  removalPolicy: cdk.RemovalPolicy.DESTROY from the CDK stack const for both tables. 

- `DeviceAttributeBackup`: Stores the original attributes of the devices.
- `DeviceFirmwareRetries`: Keeps track of the retry attempts for firmware updates.

## SNS Topic

 - `FailedFirmwareUpdate.fifo`: SNS Topic Creation to recieve notifications when device fails to update.

## IoT Core Thing Group

- '`FailedToUPdate`: Static Thing Group to hold devices that failed to update after the second cycle. 

### IAM Roles and Policies

The solution includes IAM roles and policies to provide the necessary permissions for Lambda functions and Step Functions to interact with DynamoDB, IoT, and other AWS services.

### IoT Rules

IoT rules trigger the Step Functions workflow based on messages received from IoT devices. The rules are configured to respond to specific conditions, such as firmware update failures.

## CloudWatch Logs: Log groups are created with this stack. If you do not want to destroy them upon destroying the CDK stack, remove  removalPolicy: cdk.RemovalPolicy.DESTROY from teh new logs.LogGroup in the CDK stack.

## Prerequisites

- Node.js (>= 14.x)
- Python 3.9
- AWS CLI configured with appropriate credentials
- AWS CDK
- DynamicThingGroup leveraging attributes 'FW' and 'model'

## Setup

1. Clone the repository:

    ```bash
    git clone https://github.com/RebeccaLSmith/iot-failed-job-updates.git
    cd iot-firmware-update
    ```

2. Ensure Python 3.9 is installed. You can check your Python version with:

    ```bash
    python --version
    ```

    If you need to install Python 3.9, follow the instructions for your operating system:

    - **Windows**: Download and install from [python.org](https://www.python.org/downloads/release/python-390/)
    - **MacOS**: Use Homebrew

        ```bash
        brew install python@3.9
        ```

    - **Linux**: Use your package manager, e.g., for Ubuntu:

        ```bash
        sudo apt update
        sudo apt install python3.9
        ```

3. Create and activate a virtual environment:

    - On MacOS and Linux:

        ```bash
        python3.9 -m venv .venv
        source .venv/bin/activate
        ```

    - On Windows:

        ```bash
        python3.9 -m venv .venv
        .venv\Scripts\activate.bat
        ```

4. Install the required dependencies:

    ```bash
    pip install -r requirements.txt
    ```

5. Install Node.js dependencies:

    ```bash
    npm install
    ```

6. Build the project:

    ```bash
    npm run build
    ```

7. Deploy the stack:

    ```bash
    cdk deploy
    ```

## Lambda Functions

The Lambda functions are located in the `lib/lambda` directory:

- `CheckIfDeviceExists.py`
- `CheckAndStoreDeviceAttributes.py`
- `CreateDeviceRecord.py`
- `IncrementRetryCounter.py`
- `MoveDeviceToFailedGroup.py`
- `RetryCountFailedToUpdate.py`
- `ResetRetryCounterAndMoveOut.py`
- `RestoreDeviceAttributes.py`
- `SendSNSNotification.py`
- `wait_for_propagation.py`

## Step Functions

The state machine definition is called in the CDK stack and orchestrates the workflow for handling firmware update failures.

## DynamoDB Tables

The following DynamoDB tables are created:

- `DeviceAttributeBackup`
- `DeviceFirmwareRetries`

These tables store device attributes and firmware retry counters, respectively.

## IAM Roles and Policies

The stack includes IAM roles and policies required for Lambda functions, Step Functions, and DynamoDB access.

## Testing:
- Topic
  
  ```
  iot/device/data
  ```
  
- Data:
  
    ```
     {
    "_id_": "3hwC2y7",
    "timestamp": "1711320208793",
    "status": "failed",
    "model": "wo:v8",
    "FW": "2.27"
    }
```
## Useful Commands

 * `cdk ls`          list all stacks in the app
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk docs`        open CDK documentation

## MQTT Test Clent Data
- Topic: 
    ```iot/device/data
    ```
- Data:

    ```{
        "_id_": "3hwC2y7",
        "timestamp": "1711320208793",
        "status": "failed",
        "model": "wo:v8",
        "FW": "2.27"
    }
    ```
    
Enjoy!

