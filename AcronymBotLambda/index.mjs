'use strict';

import { WebClient } from '@slack/web-api';
const {createHmac} = await import('node:crypto');
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });


// import AWS from 'aws-sdk';
// const dynamodb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
    
    console.log(JSON.stringify(event.body));
    
    console.log("request: " + JSON.stringify(event));
    
    const body = JSON.parse(event.body);
    
    // get the X-Slack-Request-Timestamp header
    
    console.log("body: " + event.body);
    const timestamp = event["headers"]["x-slack-request-timestamp"];
    const bodyString = event.body;
    console.log("unix time rn: " + Date.now() / 1000);
        
    // check for replay attacks
    if (Math.abs(Date.now()/1000 - timestamp) > 60 * 5) {
        return {
            statusCode: 400
        };
    }
    
    let sig_basestring = 'v0:' + timestamp + ':' + bodyString;
    console.log("basestring: " + sig_basestring);
    const hmac = createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
    
    hmac.update(sig_basestring);
    
    let afterHash = "v0=" + hmac.digest('hex');
    console.log("afterHash: " +  afterHash);
    console.log("target afterHash: " + event.headers["x-slack-signature"]);
    
    
    if (event.headers["x-slack-signature"] !== afterHash) {
        console.log("hash calculated has incorrect value, security risk.");
        return {
            statusCode: 400
        };
    }
    
    console.log("hash calculated has correct value");

    if (body && body.type === 'url_verification') {
        
        return {
          statusCode: 200,
          body: body.challenge
        };
    }

    // get the team_id

    // console.log("auths: " + body.event.authorizations)
    // console.log("auths[0]: " + body.event.authorizations[0])

    const teamId = body.event.team;

    let botToken;
    

    console.log("team_id: " + teamId);

    try {
        // Query DynamoDB to get the bot token for the given team ID
        const getTokenParams = {
            TableName: 'team_tokens',
            Key: {
                'team_id': { S: teamId }
            }
        };
        
        const data = await dynamoClient.send(new GetItemCommand(getTokenParams));

        console.log("retrieved db data: " + data)
        
        if (!data.Item || !data.Item.token) {
            throw new Error(`No bot token found for team ID: ${teamId}`);
        }

        botToken = data.Item.token.S;
        console.log(botToken)

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process the event' }),
        };
    }

    // retrieve the token in this fashion

    const slackClient = new WebClient(botToken);

    // check for messages that mention the bot and ask for the current score
    if (body && body.type === 'event_callback' && body.event.type === 'app_mention') {
        console.log('detected app mention');
        
        let messageText = body.event.text;
        
        // put it toLower, remove punctuation
        messageText = messageText.toLowerCase();
        
        let wordArray = messageText.split(" ");
        
        if (wordArray.length > 2 && !isNaN(parseInt(wordArray[2], 10))) {
            if (parseInt(wordArray[2], 10) > 0 && messageText.includes("score")) {
                // we have a number in the right position, which is positive, and we've been asked for the score
                
                // make the request to dynamo db
                let numPeople = parseInt(wordArray[2], 10);
                
                // reqeust here
                
                // respond with the leaderboard
                console.log("SCORE REQUESTED");
                
            }
            
        }
        
    }
    
    
    if (body && body.type === 'event_callback' && body.event.type === 'message') {
        
        console.log('detected message sent');
        
        if (body.event.bot_id) {
            
            console.log("detected a bot message");
            
            await slackClient.reactions.add({
                token: botToken,
                channel: body.event.channel,
                name: "robot_face",
                timestamp: body.event.event_ts
            });
            
            // we want to take no further action, so that our bot does not reply to itself and cause an
            // infinite loop
            
            return {
                statusCode: 200
            };
            
        }
        
        // keep a tally of acronyms for the database
        
        let tally = 0;
        
        // grab the text
        let messageText = body.event.text;
        
        // put it toLower, remove punctuation
        messageText = messageText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        
        // split by spaces
        let wordArray = messageText.split(" ");
        console.log("word array: " + wordArray.toString());
        
        
        
        // iterate through list, looking for the csm pattern
        
        let reacted = false;
        
        for (let i = 0; i < wordArray.length - 2; i++) {
            if (wordArray[i][0] === 'c' && wordArray[i+1][0] === 's' && wordArray[i+2][0] === 'm')  {
                
                if (!reacted) {
                    
                    await slackClient.reactions.add({
                        token: botToken,
                        channel: body.event.channel,
                        name: "eyes",
                        timestamp: body.event.event_ts
                    });
                    
                    tally += 1;
                    
                    reacted = true;
                    
                }
                
                let quote = ">" + wordArray[i][0].toUpperCase() + wordArray[i].slice(1, wordArray[i].length) + " " + 
                                  wordArray[i+1][0].toUpperCase() + wordArray[i+1].slice(1, wordArray[i+1].length) + " " + 
                                  wordArray[i+2][0].toUpperCase() + wordArray[i+2].slice(1, wordArray[i+2].length) + " " +
                                  "\nnice";
                
                await slackClient.chat.postMessage({
                    token: botToken,
                    channel: body.event.channel,
                    text: "nice",
                    blocks: [{"type": "section", "text": {"type": "mrkdwn", "text": quote}}],
                    thread_ts: body.event.event_ts
                });
                
            }
            
        }
        
        // now update table 
        
        // check if channel, user is present
        
        // const columnName = 'yourColumnName';
        // const columnValue = 'desiredValue';
    
        // const params = {
        //   TableName: 'YourDynamoDBTableName',
        //   FilterExpression: `${columnName} =] :value`,
        //   ExpressionAttributeValues: {
        //     ':value': columnValue,
        //   },
        // };
    
        // const result = await dynamodb.scan(params).promise();
    
        // console.log('Query Result:', result.Items);
        
        
        // if not, add entry with 0
        
        // then, add tally to that entry
        
        let thanked = false;
        
        if (messageText.includes("good bot") && !thanked) {
            
            await slackClient.reactions.add({
                token: botToken,
                channel: body.event.channel,
                name: "heart",
                timestamp: body.event.event_ts
            });
            
            await slackClient.chat.postMessage({
                token: botToken,
                channel: body.event.channel,
                text: "nOT a pRoBleM",
                thread_ts: body.event.event_ts
            });
            
            thanked = true;
            
        }
        
        let scolded = false;
        
        if (messageText.includes("bad bot") && !scolded) {
            
            await slackClient.reactions.add({
                token: botToken,
                channel: body.event.channel,
                name: "cry",
                timestamp: body.event.event_ts
            });
            
            await slackClient.chat.postMessage({
                token: botToken,
                channel: body.event.channel,
                text: "uncommon slackbot L",
                thread_ts: body.event.event_ts
            });
            
            scolded = true;
            
        }
        
        
        let dealMentioned = false;
        
        if (messageText.includes("deal") && !dealMentioned) {
            
            await slackClient.reactions.add({
                token: botToken,
                channel: body.event.channel,
                name: "moneybag",
                timestamp: body.event.event_ts
            });
            
            await slackClient.chat.postMessage({
                token: botToken,
                channel: body.event.channel,
                blocks: [{"type": "section", "text": {"type": "mrkdwn", "text": ">deal\n looks like someone wants to play Monopoly Deal"}}],
                thread_ts: body.event.event_ts
            });
            
            dealMentioned = true;
            
        }
        
        let setMentioned = false;
        
        if (messageText.includes("set") && !setMentioned) {
            
            await slackClient.reactions.add({
                token: botToken,
                channel: body.event.channel,
                name: "diamonds",
                timestamp: body.event.event_ts
            });
            
            await slackClient.chat.postMessage({
                token: botToken,
                channel: body.event.channel,
                blocks: [{"type": "section", "text": {"type": "mrkdwn", "text": ">set\n looks like someone wants to play SET"}}],
                thread_ts: body.event.event_ts
            });
            
            dealMentioned = true;
            
        }
        
        let coldMentioned = false;
        
        if (messageText.includes("cold") && !coldMentioned) {
            
            await slackClient.reactions.add({
                token: botToken,
                channel: body.event.channel,
                name: "snowflake",
                timestamp: body.event.event_ts
            });
            
            await slackClient.chat.postMessage({
                token: botToken,
                channel: body.event.channel,
                text: "IT'S COOOOOLLLLLDDDDD!!!",
                thread_ts: body.event.event_ts
            });
            
            coldMentioned = true;
            
        }
        
        let byeMentioned = false;
        
        if (messageText.includes("bye") && !coldMentioned) {
            
            await slackClient.reactions.add({
                token: botToken,
                channel: body.event.channel,
                name: "wave",
                timestamp: body.event.event_ts
            });
            
            await slackClient.chat.postMessage({
                token: botToken,
                channel: body.event.channel,
                blocks: [{"type": "section", "text": {"type": "mrkdwn", "text": ">bye\n toodleloo!"}}],
                thread_ts: body.event.event_ts
            });
            
            byeMentioned = true;
            
        }
        
        if (messageText.includes('so true') && !wordArray.includes("bestie")) {
            await slackClient.chat.postMessage({
                token: botToken,
                channel: body.event.channel,
                text: "sooooooo true bestie",
                thread_ts: body.event.event_ts
            });
        }
        
        
        return {
            statusCode: 200
        };
        
        
    }
    
    console.log('different kind of message sent, probably a mention. No defined action for this yet');
    
    return {
        statusCode: 200
    };
    
    
};