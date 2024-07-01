import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('DeviceFirmwareRetries')
iot = boto3.client('iot')

def handler(event, context):
    device_id = event['deviceId']
    
    if not device_id:
        return {
            'statusCode': 400,
            'deviceId': device_id,
            'resetRetryCount': None,
            'message': 'deviceId is required'
        }
    
    try:
        # Fetch current item from DynamoDB
        response = table.get_item(Key={'deviceId': device_id})
        
        if 'Item' in response:
            item = response['Item']
            reset_retry_count = item['ResetRetryCount'] + 1
            
            # Update the retry count and device attributes
            update_device_attributes(device_id, "failedtoupdate", "failedtoupdate")
            logger.info(f"Updated device attributes to 'failedtoupdate' for device {device_id}")
            
            # Update DynamoDB with new resetRetryCount
            table.update_item(
                Key={'deviceId': device_id},
                UpdateExpression="set ResetRetryCount=:rr",
                ExpressionAttributeValues={
                    ':rr': reset_retry_count
                }
            )
            logger.info(f"Incremented ResetRetryCount to {reset_retry_count} for device {device_id}")
            
            return {
                'statusCode': 200,
                'deviceId': device_id,
                'resetRetryCount': reset_retry_count
            }
        else:
            return {
                'statusCode': 404,
                'deviceId': device_id,
                'resetRetryCount': None,
                'message': 'Device not found'
            }
    except Exception as e:
        logger.error(f"Failed to update device attributes to 'failedtoupdate' for device {device_id}: {e}")
        return {
            'statusCode': 500,
            'deviceId': device_id,
            'resetRetryCount': None,
            'message': f"Error updating device attributes to 'failedtoupdate' for device {device_id}: {e}"
        }

def update_device_attributes(device_id, model, FW):
    try:
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
    except Exception as e:
        raise Exception(f"Failed to update device attributes: {e}")