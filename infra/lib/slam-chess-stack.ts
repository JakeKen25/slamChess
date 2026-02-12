import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'node:path';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class SlamChessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const gameTable = new dynamodb.Table(this, 'Games', {
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const makeFn = (name: string, entryFile: string) => {
      const fn = new NodejsFunction(this, name, {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(process.cwd(), entryFile),
        handler: 'handler',
        bundling: {
          format: OutputFormat.CJS,
          target: 'node20'
        },
        environment: { GAME_TABLE_NAME: gameTable.tableName }
      });
      gameTable.grantReadWriteData(fn);
      return fn;
    };

    const createGame = makeFn('CreateGameFn', 'src/backend/handlers/createGame.ts');
    const getGame = makeFn('GetGameFn', 'src/backend/handlers/getGame.ts');
    const submitMove = makeFn('SubmitMoveFn', 'src/backend/handlers/submitMove.ts');
    const listHistory = makeFn('ListHistoryFn', 'src/backend/handlers/listHistory.ts');
    const legalMoves = makeFn('LegalMovesFn', 'src/backend/handlers/legalMoves.ts');

    const api = new apigwv2.HttpApi(this, 'SlamChessApi');
    api.addRoutes({ path: '/games', methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration('CreateGameInt', createGame) });
    api.addRoutes({ path: '/games/{gameId}', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('GetGameInt', getGame) });
    api.addRoutes({ path: '/games/{gameId}/moves', methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration('SubmitMoveInt', submitMove) });
    api.addRoutes({ path: '/games/{gameId}/history', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('HistoryInt', listHistory) });
    api.addRoutes({ path: '/games/{gameId}/legal-moves', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('LegalMovesInt', legalMoves) });

    new cdk.CfnOutput(this, 'ApiEndpoint', { value: api.url! });
  }
}
