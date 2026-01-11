const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");

// Initialize SQS Client with lazy loading pattern
let sqsClient = null;

function getSQSClient() {
    if (!sqsClient) {
        const requiredEnvVars = [
            'AWS_REGION',
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_SQS_QUEUE_URL'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            const errorMsg = `Missing required AWS SQS environment variables: ${missingVars.join(', ')}`;
            console.error('❌', errorMsg);
            throw new Error(errorMsg);
        }

        sqsClient = new SQSClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        console.log('✅ SQS Client initialized successfully');
    }
    return sqsClient;
}

/**
 * Send a message to SQS
 * @param {Object} data - The message body (will be stringified)
 * @param {string} topic - The topic/category for the message
 */
async function sendSQSMessage(data, topic = 'general') {
    const client = getSQSClient();
    const body = JSON.stringify({
        ...data,
        topic,
        timestamp: new Date().toISOString()
    });

    const command = new SendMessageCommand({
        QueueUrl: process.env.AWS_SQS_QUEUE_URL,
        MessageBody: body,
        MessageAttributes: {
            "Topic": {
                DataType: "String",
                StringValue: topic
            }
        }
    });

    return await client.send(command);
}

/**
 * Receive messages from SQS
 * @param {number} maxMessages - Max messages to receive (1-10)
 * @returns {Promise<Array>} - Array of messages
 */
async function receiveSQSMessages(maxMessages = 5) {
    const client = getSQSClient();
    const command = new ReceiveMessageCommand({
        QueueUrl: process.env.AWS_SQS_QUEUE_URL,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20, // Long polling
        MessageAttributeNames: ["All"]
    });

    const response = await client.send(command);
    return response.Messages || [];
}

/**
 * Delete a message from SQS after processing
 * @param {string} receiptHandle - The receipt handle from the received message
 */
async function deleteSQSMessage(receiptHandle) {
    const client = getSQSClient();
    const command = new DeleteMessageCommand({
        QueueUrl: process.env.AWS_SQS_QUEUE_URL,
        ReceiptHandle: receiptHandle
    });

    return await client.send(command);
}

module.exports = {
    getSQSClient,
    sendSQSMessage,
    receiveSQSMessages,
    deleteSQSMessage
};
