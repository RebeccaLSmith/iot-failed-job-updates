#!/usr/bin/env python3
import os

import aws_cdk as cdk

from lib.iot_firmware_update_stack import IotFirmwareUpdateStack

account = os.getenv('CDK_DEFAULT_ACCOUNT')
region = os.getenv('CDK_DEFAULT_REGION')

if not account or not region:
    raise ValueError("Both CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION environment variables need to be set")

app = cdk.App()
IotFirmwareUpdateStack(app, "IotFirmwareUpdateStack",
    env=cdk.Environment(account=account, region=region)
)

app.synth()