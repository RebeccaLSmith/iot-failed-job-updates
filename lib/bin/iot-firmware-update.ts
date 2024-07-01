#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { IotFirmwareUpdateStack } from '../iot_firmware_update_stack';

const app = new cdk.App();
new IotFirmwareUpdateStack(app, 'IoTFirmwareUpdateStack');
