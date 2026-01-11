const { S3Client } = require('@aws-sdk/client-s3');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// S3 Client instance (lazy initialization)
let s3Client = null;

/**
 * Get or create S3 client instance
 * @returns {S3Client}
 */
function getS3Client() {
    if (!s3Client) {
        // Validate required environment variables
        const requiredEnvVars = [
            'AWS_REGION',
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_S3_BUCKET_NAME'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            const errorMsg = `Missing required AWS environment variables: ${missingVars.join(', ')}`;
            console.error('❌', errorMsg);
            throw new Error(errorMsg);
        }

        // Initialize S3 Client
        s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });

        console.log('✅ S3 Client initialized successfully');
    }

    return s3Client;
}

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Name of the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} - S3 file key
 */
async function uploadToS3(fileBuffer, fileName, mimeType) {
    const key = `uploads/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
    });

    const client = getS3Client();
    await client.send(command);
    return key;
}

/**
 * Generate signed URL for file access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Signed URL
 */
async function getSignedUrlForFile(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
    });

    const client = getS3Client();
    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
}

/**
 * Get file from S3 as a stream
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} - S3 object response
 */
async function getFileFromS3(key) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
    });

    const client = getS3Client();
    const response = await client.send(command);
    return response;
}

/**
 * Generate a public CloudFront URL for a given S3 key
 * @param {string} key - S3 object key
 * @returns {string|null} - CloudFront URL or null if domain not configured
 */
function getCloudFrontUrl(key) {
    const domain = process.env.AWS_CLOUDFRONT_DOMAIN;
    if (!domain) return null;

    // Ensure domain doesn't end with / and key doesn't start with /
    const cleanDomain = domain.replace(/\/$/, '');
    const cleanKey = key.replace(/^\//, '');

    return `https://${cleanDomain}/${cleanKey}`;
}

module.exports = {
    getS3Client,
    uploadToS3,
    getSignedUrlForFile,
    getFileFromS3,
    getCloudFrontUrl,
};
