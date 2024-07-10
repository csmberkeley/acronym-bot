'use strict';

import { WebClient } from '@slack/web-api';
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

export const handler = async (event) => {
    
    // link that redirects us here
    // "https://slack.com/oauth/v2/authorize?scope=channels%3Ahistory%2Cchannels%3Amanage%2Cchannels%3Aread%2Cchat%3Awrite%2Cgroups%3Ahistory%2Creactions%3Aread%2Creactions%3Awrite&amp;user_scope=&amp;redirect_uri=https%3A%2F%2Fwqx5rpuxnmizg4l3nlalamfcdm0ekprb.lambda-url.us-east-1.on.aws%2F&amp;client_id=843452174659.6407286023969"

    // api endpoint link: https://xhj75964b4.execute-api.us-east-1.amazonaws.com/prod/auth

    // full add-to-workspace link: https://slack.com/oauth/v2/authorize?scope=app_mentions%3Aread%2Cchannels%3Ahistory%2Cchannels%3Amanage%2Cchannels%3Aread%2Cchat%3Awrite%2Cgroups%3Ahistory%2Creactions%3Aread%2Creactions%3Awrite&amp;user_scope=&amp;redirect_uri=https%3A%2F%2Fxhj75964b4.execute-api.us-east-1.amazonaws.com%2Fprod%2Fauth&amp;client_id=843452174659.6407286023969


    console.log("entered function");

    // const event_json = JSON.parse(event);
    console.log("event");
    console.log(event);
    
    // const body = JSON.parse(event.body);
    
    const code = event.queryStringParameters.code;
    
    // console.log("body");
    // console.log(body);
    console.log("code");
    console.log(code);
    
    // send code to slack

    const slackClient = new WebClient(null);
    
    const resp = await slackClient.oauth.v2.access({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                code: code,
                redirect_uri: process.env.REDIRECT_URI
            });
    
    console.log("sent message, received response")

    console.log(resp)
    
    // grab the token from the request and store in the appropriate place
    
    const token = resp.access_token;
    const team_id = resp.team.id;

    console.log("token, team_id")
    console.log(token)
    console.log(team_id)
    
    // store in dynamo db

    const tableName = 'team_tokens';
    const item = {
        team_id: { S: team_id },
        token: { S: token }
    };

    console.log("created items")

    const params = {
        TableName: tableName,
        Item: item,
    };

    try {
        const command = new PutItemCommand(params);
        const result = await dynamoClient.send(command);
        console.log('Item inserted:', result);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Item inserted successfully.', result }),
        };
    } catch (error) {
        console.error('Error inserting item:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error inserting item.', error }),
        };
    }
    
};

