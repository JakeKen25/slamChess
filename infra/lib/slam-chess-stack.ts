import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';

export class SlamChessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const gameTable = new dynamodb.Table(this, 'Games', {
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const makeFn = (name: string, handler: string) => {
      const fn = new lambda.Function(this, name, {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset('dist/src'),
        handler,
        environment: { GAME_TABLE_NAME: gameTable.tableName, LOG_LEVEL: 'info' },
        logRetention: logs.RetentionDays.ONE_WEEK
      });
      gameTable.grantReadWriteData(fn);
      return fn;
    };

    const createGame = makeFn('CreateGameFn', 'backend/handlers/createGame.handler');
    const getGame = makeFn('GetGameFn', 'backend/handlers/getGame.handler');
    const submitMove = makeFn('SubmitMoveFn', 'backend/handlers/submitMove.handler');
    const joinGame = makeFn('JoinGameFn', 'backend/handlers/joinGame.handler');
    const listHistory = makeFn('ListHistoryFn', 'backend/handlers/listHistory.handler');
    const legalMoves = makeFn('LegalMovesFn', 'backend/handlers/legalMoves.handler');

    const accessLogs = new logs.LogGroup(this, 'ApiAccessLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const api = new apigwv2.HttpApi(this, 'SlamChessApi', {
      createDefaultStage: false
    });

    new apigwv2.CfnStage(this, 'SlamChessDefaultStage', {
      apiId: api.apiId,
      stageName: '$default',
      autoDeploy: true,
      accessLogSettings: {
        destinationArn: accessLogs.logGroupArn,
        format: JSON.stringify({
          requestId: '$context.requestId',
          ip: '$context.identity.sourceIp',
          requestTime: '$context.requestTime',
          routeKey: '$context.routeKey',
          status: '$context.status',
          responseLength: '$context.responseLength',
          integrationError: '$context.integrationErrorMessage'
        })
      }
    });
    api.addRoutes({ path: '/games', methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration('CreateGameInt', createGame) });
    api.addRoutes({ path: '/games/{gameId}', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('GetGameInt', getGame) });
    api.addRoutes({ path: '/games/{gameId}/moves', methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration('SubmitMoveInt', submitMove) });
    api.addRoutes({ path: '/games/{gameId}/join', methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration('JoinGameInt', joinGame) });
    api.addRoutes({ path: '/games/{gameId}/history', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('HistoryInt', listHistory) });
    api.addRoutes({ path: '/games/{gameId}/legal-moves', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('LegalMovesInt', legalMoves) });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: cdk.Fn.sub('https://${ApiId}.execute-api.${AWS::Region}.${AWS::URLSuffix}/', {
        ApiId: api.apiId
      })
    });
  }
}
