import boto3
import logging

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('DeviceFirmwareRetries')

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    device_id = event.get('deviceId')
    model = event.get('model')
    FW = event.get('FW')
    
    
    if not device_id:
        return {
            'statusCode': 400,
            'deviceExists': False,
            'message': 'deviceId is required'   
        }
    
    try:
        response = table.get_item(Key={'deviceId': device_id})
        
        if 'Item' in response:
            item = response['Item']
            retry_count = item.get('RetryCounter', 0)
            reset_retry_count = item.get('ResetRetryCount', 0)
            return {
                'statusCode': 200,
                'deviceExists': True,
                'RetryCounter': retry_count,
                'ResetRetryCount': reset_retry_count,
                'deviceId': device_id,
                'model': model,
                "FW": FW
            }
        else:
            return {
                'statusCode': 404,
                'deviceExists': False,
                'deviceId': device_id,
                'model': model,
                'FW': FW
            }
    except Exception as e:
        logger.error(f"Error checking device existence: {str(e)}")
        return {
            'statusCode': 500,
            'deviceExists': False,
            'deviceId': device_id,
            'message': f"Error checking device existence: {str(e)}"
        }