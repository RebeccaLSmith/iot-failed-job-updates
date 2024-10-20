import time

def handler(event, context):
    print("Waiting for IAM role propagation...")
    time.sleep(60)  # Wait for 60 seconds
    return {
        'statusCode': 200,
        'body': 'Waited for 60 seconds'
    }