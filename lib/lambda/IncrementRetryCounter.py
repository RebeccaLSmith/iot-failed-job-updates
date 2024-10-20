import json
import boto3
import logging

dynamodb = boto3.resource('dynamodb')
retries_table = dynamodb.Table('DeviceFirmwareRetries')

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    try:
        device_id = event.get('deviceId')
        
        if not device_id:
            return {
                'statusCode': 400,
                'RetryCounter': None,
                'ResetRetryCount': None,
                'message': 'deviceId is required'
            }
        
        response = retries_table.get_item(Key={'deviceId': device_id})
        logger.info(response)
        
        if 'Item' in response:
            item = response['Item']
            retry_counter = item.get('RetryCounter', 0)
            reset_retry_count = item.get('ResetRetryCount', 0)
            
            # Increment the retry counter
            retry_counter += 1
            
            # Update the retry counter in the table
            retries_table.update_item(
                Key={'deviceId': device_id},
                UpdateExpression='SET RetryCounter = :val',
                ExpressionAttributeValues={':val': retry_counter}
            )
            
            return {
                'statusCode': 200,
                'RetryCounter': retry_counter,
                'ResetRetryCount': reset_retry_count,
                'deviceId': device_id
            }
        else:
            return {
                'statusCode': 404,
                'RetryCounter': None,
                'ResetRetryCount': None,
                'message': 'Device not found'
            }
    except KeyError as e:
        logger.error(f"Missing key in event data: {str(e)}")
        return {
            'statusCode': 400,
            'RetryCounter': None,
            'ResetRetryCount': None,
            'message': f"Missing key in event data: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Unhandled error: {str(e)}")
        return {
            'statusCode': 500,
            'RetryCounter': None,
            'ResetRetryCount': None,
            'message': f"Error: {str(e)}"
        }