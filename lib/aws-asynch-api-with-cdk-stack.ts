import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';

export class AwsAsynchApiWithCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'AwsAsynchApiWithCdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
    //Define the queues
    const asyncApiMessageDLQ = new sqs.Queue(this, 'asyncApiMessageDLQ', {});
    const asyncApiMessageQueue = new sqs.Queue(this, 'asyncApiMessageQueue', {
        deadLetterQueue: {
            maxReceiveCount: 3,
            queue: asyncApiMessageDLQ
        }
    });

    //Define the IAM role
    const asyncApiApigRole = new iam.Role(this, 'asyncApiApigRole', {
        assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    });

    asyncApiApigRole.addToPolicy(new iam.PolicyStatement({
        resources: [
            asyncApiMessageQueue.queueArn
        ],
        actions: [
            'sqs:SendMessage'
        ]
    }));
    asyncApiApigRole.addToPolicy(new iam.PolicyStatement({
        resources: [
            '*'
        ],
        actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:DescribeLogGroups',
            'logs:DescribeLogStreams',
            'logs:PutLogEvents',
            'logs:GetLogEvents',
            'logs:FilterLogEvents'
        ]
    }));


    //Define API Gateway
    const asyncApi = new apigateway.RestApi(this, 'asyncApi', {
      policy: new iam.PolicyDocument({
          statements: [
              new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  actions: [
                      "execute-api:Invoke"
                  ],
                  resources: [
                      "*"
                  ],
                  principals: [
                      new iam.AnyPrincipal()
                  ]
              })
          ]
      }),
      deployOptions: {
          loggingLevel: apigateway.MethodLoggingLevel.INFO,
          dataTraceEnabled: true
      }
  });


    //Define API Gateway Integration
    const awsSqsIntegration = new apigateway.AwsIntegration({
      service: "sqs",
      integrationHttpMethod: "POST",
      options: {
          passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
          credentialsRole: asyncApiApigRole,
          requestParameters: {
              "integration.request.header.Content-Type": "'application/x-www-form-urlencoded'"
          },
          requestTemplates: {
              "application/json": "Action=SendMessage&MessageBody=$util.urlEncode(\"$input.body\")"
          },
          integrationResponses: [
              {
                  statusCode: "200",
                  responseTemplates: {
                      "text/html": "Success"
                  }
              },
              {
                  statusCode: "500",
                  responseTemplates: {
                      "text/html": "Error"
                  },
                  selectionPattern: "500"
              }
          ]
      },
      path: cdk.Aws.ACCOUNT_ID + "/" + asyncApiMessageQueue.queueName
  });


    //Define API Gateway Resource
    const asyncEndpointResource = asyncApi.root.addResource('async_endpoint');


    //Define API Gateway Method
    asyncEndpointResource.addMethod('POST', awsSqsIntegration, {
        methodResponses: [
            {
                statusCode: "200",
                responseParameters: {
                    "method.response.header.Content-Type": true
                }
            },
            {
                statusCode: "500",
                responseParameters: {
                    "method.response.header.Content-Type": true
                },
            }
        ]
    });

    //Define lambda function
    const lambdaFunction = new lambda.Function(this, 'asyncProcessFunc', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda')  // code loaded from "lambda" directory
  });

  //Add the SQS event source to the lambda function
  lambdaFunction.addEventSource(new SqsEventSource(asyncApiMessageQueue));

  }
}
