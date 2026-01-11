const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const uploadRoutes = require('./uploadRoutes');
const { receiveSQSMessages, deleteSQSMessage, sendSQSMessage } = require('./sqsConfig');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
// Middleware 
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Mount upload routes
app.use('/api', uploadRoutes);

// Basic route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Express App!',
        status: 'Server is running successfully',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            test: '/test - Upload test page',
            health: '/health - Health check',
            upload: '/api/upload - Upload single file',
            uploadMultiple: '/api/upload/multiple - Upload multiple files',
            signedUrl: '/api/get-signed-url - Get signed URL',
            fetchFile: '/api/files/:key - Fetch file content directly',
            dashboard: '/dashboard - Live SQS Messaging Dashboard'
        }
    });
});

// Serve test upload page
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-upload.html'));
});

// Serve the live dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// API endpoint to send SQS messages (useful for testing from external tools)
app.post('/api/messages', async (req, res) => {
    try {
        const { text, topic } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        await sendSQSMessage({ text }, topic);
        res.json({ success: true, message: 'Message queued' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        uptime: process.uptime(),
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Example API routes
app.get('/api/users', (req, res) => {
    res.json({
        users: [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        ]
    });
});

app.post('/api/users', (req, res) => {
    const { name, email } = req.body;
    res.status(201).json({
        message: 'User created successfully',
        user: { id: 3, name, email }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// SQS Polling Loop
async function startSQSPolling() {
    console.log('📡 Starting SQS polling loop...');
    while (true) {
        try {
            const messages = await receiveSQSMessages(5);
            for (const message of messages) {
                try {
                    const body = JSON.parse(message.Body);
                    console.log(`📩 New SQS Message: [${body.topic}] ${JSON.stringify(body)}`);

                    // Broadcast to all connected clients via Socket.io
                    io.emit('message', body);

                    // Delete message from queue after processing
                    await deleteSQSMessage(message.ReceiptHandle);
                } catch (parseErr) {
                    console.error('Failed to parse SQS message:', parseErr);
                }
            }
        } catch (error) {
            console.error('SQS Polling Error:', error);
            // Wait a bit before retrying on error
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('🔌 New browser client connected:', socket.id);

    socket.on('send-message', async (data) => {
        try {
            const { text, topic } = data;
            console.log(`📡 Sending message to SQS: [${topic}] ${text}`);
            await sendSQSMessage({ text, senderId: socket.id }, topic);
        } catch (error) {
            console.error('Socket send-message error:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}/dashboard`);

    // Start the SQS poller
    startSQSPolling();
});
