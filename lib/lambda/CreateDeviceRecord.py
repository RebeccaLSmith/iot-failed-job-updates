import boto3
import logging
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
retries_table = dynamodb.Table('DeviceFirmwareRetries')

def handler(event, context):
    try:
        device_id = event.get('deviceId')
        
        if not device_id:
            logger.error("Device ID must be provided.")
            return {
                'statusCode': 400,
                'deviceId': device_id,
                'message': "Error: 'deviceId' is required."
            }
        
        current_time = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # Check if the device record already exists in DeviceFirmwareRetries
        response = retries_table.get_item(Key={'deviceId': device_id})
        if 'Item' in response:
            # Device record exists, update it
            retries_table.update_item(
                Key={'deviceId': device_id},
                UpdateExpression='SET RetryCounter = :rc, ResetRetryCount = :rrc, timestamp = :ts',
                ExpressionAttributeValues={
                    ':rc': 0,
                    ':rrc': 0,
                    ':ts': current_time
                }
            )
        else:
            # Device record does not exist, create it
            retries_table.put_item(
                Item={
                    'deviceId': device_id,
                    'RetryCounter': 0,
                    'ResetRetryCount': 0,
                    'timestamp': current_time
                }
            )
        
        logger.info(f"Device firmware record created or updated for {device_id}.")
        return {
            'statusCode': 200,
            'deviceId': device_id,
            'RetryCounter': 0,
            'ResetRetryCount': 0,
            'Timestamp': current_time
        }
    
    except Exception as e:
        logger.error(f"Error creating or updating device firmware record: {str(e)}")
        return {
            'statusCode': 500,
            'deviceId': device_id,
            'RetryCounter': None,
            'ResetRetryCount': None,
            'Timestamp': None,
            'message': f"Error creating or updating device firmware record: {str(e)}"
        }