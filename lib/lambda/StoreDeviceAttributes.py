import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
backup_table = dynamodb.Table('DeviceAttributeBackup')

def handler(event, context):
    try:
        device_id = event.get('deviceId')
        FW = event.get('FW')
        model = event.get('model')
        
        if not device_id or not FW or not model:
            logger.error("Device ID, FW, and model must be provided.")
            return {
                'statusCode': 400,
                'deviceId': device_id,
                'message': "Error: 'deviceId', 'FW', and 'model' are required."
            }
        
        # Check if the original attributes already exist in DeviceAttributeBackup
        response = backup_table.get_item(Key={'deviceId': device_id})
        if 'Item' not in response:
            # Store the original attributes if not present
            backup_table.put_item(
                Item={
                    'deviceId': device_id,
                    'FW': FW,
                    'model': model
                }
            )
            logger.info(f"Stored original attributes for device {device_id}.")
        else:
            logger.info(f"Original attributes already exist for device {device_id}.")
        
        return {
            'statusCode': 200,
            'deviceId': device_id,
            'FW': FW,
            'model': model
        }
    
    except Exception as e:
        logger.error(f"Error checking or storing device attributes: {str(e)}")
        return {
            'statusCode': 500,
            'deviceId': device_id,
            'FW': FW,
            'model': model,
            'message': f"Error checking or storing device attributes: {str(e)}"
        }