import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

iot = boto3.client('iot')

def handler(event, context):
    device_id = event['deviceId']
    
    if not device_id:
        return {
            'statusCode': 400,
            'deviceId': device_id,
            'message': 'deviceId is required'
        }
    
    try:
        move_device_to_failed_group(device_id)
        logger.info(f"Device {device_id} moved to failed group.")
        
        return {
            'statusCode': 200,
            'deviceId': device_id,
            'message': f"Device {device_id} moved to failed group."
        }
    except Exception as e:
        logger.error(f"Failed to move device {device_id} to failed group: {e}")
        return {
            'statusCode': 500,
            'deviceId': device_id,
            'message': f"Error moving device {device_id} to failed group: {e}"
        }

def move_device_to_failed_group(device_id):
    failed_group_name = "FailedToUpdate"
    iot.add_thing_to_thing_group(
        thingGroupName=failed_group_name,
        thingName=device_id
    )