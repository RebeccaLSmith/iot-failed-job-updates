import boto3
import logging
import json
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
iot = boto3.client('iot')
table = dynamodb.Table('DeviceAttributeBackup')

def handler(event, context):
    device_id = event.get('deviceId')
    
    if not device_id:
        logger.error("No deviceId provided in the event.")
        return {
            'statusCode': 400,
            'body': json.dumps("deviceId is required")
        }
    
    try:
        response = table.get_item(Key={'deviceId': device_id})
        if 'Item' not in response or not response['Item'].get('FW') or not response['Item'].get('model'):
            logger.error(f"No original attributes found for device {device_id}.")
            return {
                'statusCode': 404,
                'body': json.dumps(f"No original attributes found for device {device_id}.")
            }

        original_attributes = {
            'FW': response['Item']['FW'],
            'model': response['Item']['model']
        }
        logger.info(f"Original attributes retrieved for device {device_id}: {original_attributes}")

        # Update the device attributes in IoT
        iot.update_thing(
            thingName=device_id,
            attributePayload={
                'attributes': original_attributes,
                'merge': False
            }
        )
        
        logger.info(f"Original attributes restored for device {device_id}.")
            
        return {
            'statusCode': 200,
            'body': json.dumps(f"Original attributes restored for device {device_id}.")
        }
    except Exception as e:
        logger.error(f"Error retrieving original attributes for device {device_id}: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error retrieving original attributes for device {device_id}: {str(e)}")
        }