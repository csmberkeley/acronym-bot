# acronym-bot
## Acronym Bot looks through your messages and finds CSM acronyms!
### Usage
For example, 
> **C**reate **S**pontaneous **M**iracles

would be an example of such a sentence.

Add the bot to your workspace by clicking [here](https://slack.com/oauth/v2/authorize?scope=chat%3Awrite%2Creactions%3Aread%2Creactions%3Awrite%2Cgroups%3Ahistory%2Cchannels%3Amanage%2Cchannels%3Aread%2Cchannels%3Ahistory%2Capp_mentions%3Aread&user_scope=&redirect_uri=https%3A%2F%2Fxhj75964b4.execute-api.us-east-1.amazonaws.com%2Fprod%2Fauth&client_id=843452174659.6407286023969&_gl=1*gq3iwl*_gcl_au*NTYwMjMxMDA5LjE3MTk1MDMyODU.*_ga*Nzk1MDg5MjAzLjE2Njg3MTYzNDU.*_ga_QTJQME5M5D*MTcyMDQ1Mzk2My4xMDIuMS4xNzIwNDU0MTczLjAuMC4w)! From then on, invite the bot to any channel you want it to listen in on, and it respond to all messages on that channel. 

There are also some easter eggs (certain phrases that will trigger the bot to reply with a response), so be on the lookout for those!

---

### Technical Notes
There are two AWS Lambdas and one DynamoDB table that are needed to run this. The code you see here is a copy of the version that is actually running in the lambda instances: if you'd like to make changes _please_ make the changes in both places.  

The Slackbot sends events to the `acronymBotLambda` function. Slack sends a challenge to bots attempting to join a workspace, so the bot checks to see if the incoming message is a challenge, and respends with a 200.

Then, it does a quick check of the message, hashing the contents and a `SLACK_SIGNING_SECRET` along with the unix time it was sent at as a checksum that the message actually came from Slack (Slack sends the correct hash as a checksum). The `SLACK_SIGNING_SECRET` (as well as the `SLACK_BOT_TOKEN`, which is used to send replies) were generated when the bot was made, and are stored in the configuration tab of the lambda.

After the verification, it proceeds to scan the message for acronyms and other fun stuff.

The dynamoDB table is a mapping between the worspace (team) ID and the bot token installed in that workspace. We need to do this because the bot token must be specified to send back the message to the appropriate workspace, but any given message that the bot is listening in on might be from any team: we can see the workspace (team) ID, we use the table to see what the appropriate bot to use is, and we send back the response using that bot token.

The other lambda, `authHandler` handles, well...the authorization of the bots. The way this works is that, upon clicking the link, Slack sends some information to the lambda, which we relay back for two step authentification. Slack then sends a GET request to the lambda with all of the bot info, including the new token. At this point, the bot has been added to the workspace, but we should store the team id and bot token in the database so that the other lambda can get it from the table and send using the appropriate bot token.