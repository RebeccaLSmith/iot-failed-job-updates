import boto3
import os
import logging
import json
import hashlib

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sns = boto3.client('sns')


def handler(event, context):
    device_id = event['deviceId']
    sns_topic_arn = event['snsTopicArn']
    
    try:
        sns_message = f"Device {device_id} exceeded retry limits twice. Manual intervention required."
        
        # Generate a unique MessageDeduplicationId
        deduplication_id = hashlib.md5(sns_message.encode('utf-8')).hexdigest()
        
        response = sns.publish(
            TopicArn=sns_topic_arn,
            Message=sns_message,
            Subject='Firmware Update Failure Alert',
            MessageGroupId='FirmwareUpdateFailure',  # This should be unique for different groups of messages
            MessageDeduplicationId=deduplication_id  # Unique deduplication ID
        )
        
        logger.info(f"Alert sent for device {device_id}. Message ID: {response['MessageId']}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f"Alert sent for device {device_id}.",
                'messageId': response['MessageId']
            })
        }
    except Exception as e:
        logger.error(f"Failed to send alert for device {device_id}: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error sending alert for device {device_id}: {e}")
        }