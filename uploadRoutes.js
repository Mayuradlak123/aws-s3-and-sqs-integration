const express = require('express');
const multer = require('multer');
const { uploadToS3, getSignedUrlForFile, getFileFromS3, getCloudFrontUrl } = require('./s3Config');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images, PDFs, and documents
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
        }
    },
});

/**
 * POST /api/upload
 * Upload a single file to S3
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided',
            });
        }

        const { buffer, originalname, mimetype } = req.file;

        // Upload to S3
        const fileKey = await uploadToS3(buffer, originalname, mimetype);

        // Generate signed URL for immediate access
        const signedUrl = await getSignedUrlForFile(fileKey, 3600); // 1 hour expiry

        // Generate CloudFront URL for cached access
        const cloudFrontUrl = getCloudFrontUrl(fileKey);

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                fileKey,
                fileName: originalname,
                fileSize: buffer.length,
                mimeType: mimetype,
                signedUrl,
                cloudFrontUrl,
                expiresIn: 3600,
            },
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload file',
            message: error.message,
        });
    }
});

/**
 * POST /api/upload/multiple
 * Upload multiple files to S3
 */
router.post('/upload/multiple', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files provided',
            });
        }

        const uploadPromises = req.files.map(async (file) => {
            const fileKey = await uploadToS3(file.buffer, file.originalname, file.mimetype);
            const signedUrl = await getSignedUrlForFile(fileKey, 3600);
            const cloudFrontUrl = getCloudFrontUrl(fileKey);

            return {
                fileKey,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                signedUrl,
                cloudFrontUrl,
            };
        });

        const uploadedFiles = await Promise.all(uploadPromises);

        res.status(200).json({
            success: true,
            message: `${uploadedFiles.length} file(s) uploaded successfully`,
            data: uploadedFiles,
            expiresIn: 3600,
        });
    } catch (error) {
        console.error('Multiple upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload files',
            message: error.message,
        });
    }
});

/**
 * POST /api/get-signed-url
 * Get a signed URL for an existing S3 file
 */
router.post('/get-signed-url', async (req, res) => {
    try {
        const { fileKey, expiresIn = 3600 } = req.body;

        if (!fileKey) {
            return res.status(400).json({
                success: false,
                error: 'fileKey is required',
            });
        }

        // Validate expiration time (max 7 days)
        const maxExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
        const expiry = Math.min(parseInt(expiresIn), maxExpiry);

        const signedUrl = await getSignedUrlForFile(fileKey, expiry);
        const cloudFrontUrl = getCloudFrontUrl(fileKey);

        res.status(200).json({
            success: true,
            data: {
                fileKey,
                signedUrl,
                cloudFrontUrl,
                expiresIn: expiry,
                expiresAt: new Date(Date.now() + expiry * 1000).toISOString(),
            },
        });
    } catch (error) {
        console.error('Signed URL error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate signed URL',
            message: error.message,
        });
    }
});

/**
 * GET /api/files/:key
 * Fetch file content directly from S3 using key
 */
router.get('/files/:key(*)', async (req, res) => {
    try {
        const fileKey = req.params.key;

        if (!fileKey) {
            return res.status(400).json({
                success: false,
                error: 'fileKey is required',
            });
        }

        const s3Response = await getFileFromS3(fileKey);

        // Set response headers from S3 metadata
        if (s3Response.ContentType) {
            res.setHeader('Content-Type', s3Response.ContentType);
        }
        if (s3Response.ContentLength) {
            res.setHeader('Content-Length', s3Response.ContentLength);
        }

        // Stream S3 object body to Express response
        s3Response.Body.pipe(res);
    } catch (error) {
        console.error('File fetch error:', error);
        if (error.name === 'NoSuchKey') {
            return res.status(404).json({
                success: false,
                error: 'File not found',
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to fetch file',
            message: error.message,
        });
    }
});

module.exports = router;
