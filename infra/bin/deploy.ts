#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SlamChessStack } from '../lib/slam-chess-stack.js';

const app = new cdk.App();
new SlamChessStack(app, 'SlamChessStack');
