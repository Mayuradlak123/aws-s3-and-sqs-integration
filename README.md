# Express App

Basic Express.js application with essential middleware and example routes.

## Features

- ✅ Express.js server setup
- ✅ CORS enabled
- ✅ Environment variable support with dotenv
- ✅ JSON and URL-encoded body parsing
- ✅ Example API routes
- ✅ Health check endpoint
- ✅ Error handling middleware
- ✅ 404 handler
- ✅ **AWS S3 Integration**
  - Single file upload
  - Multiple file upload
  - Signed URL generation
  - File type validation
  - 10MB file size limit

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# AWS S3 & CloudFront Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_CLOUDFRONT_DOMAIN=your-distribution-id.cloudfront.net
```

### AWS CloudFront Setup (GET Only)

1. **Create a CloudFront Distribution:**
   - Go to AWS Console → CloudFront
   - Create a new distribution
   - Origin domain: Select your S3 bucket
   - OAC/OAI settings: Recommended for private buckets (or public access for simple caching)
   - Behavior: Default settings or optimized for caching
   - Copy the **Distribution domain name** to `AWS_CLOUDFRONT_DOMAIN` in `.env`

---

## API Endpoints

### Single File Upload
- **POST** `/api/upload`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "fileKey": "uploads/1234567890-file.jpg",
      "signedUrl": "...",
      "cloudFrontUrl": "https://d123.cloudfront.net/uploads/123...file.jpg"
    }
  }
  ```

## Running the Application

### Development mode (with auto-reload)
```bash
npm run dev
```

### Production mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## API Endpoints

### Root
- **GET** `/` - Welcome message

### Health Check
- **GET** `/health` - Server health status

### Users (Example)
- **GET** `/api/users` - Get all users
- **POST** `/api/users` - Create a new user

### File Upload (AWS S3)

#### Upload Single File
- **POST** `/api/upload`
- **Content-Type:** `multipart/form-data`
- **Body:** `file` (form field)
- **Supported formats:** JPEG, PNG, GIF, WebP, PDF, DOC, DOCX
- **Max size:** 10MB
- **Response:**
  ```json
  {
    "success": true,
    "message": "File uploaded successfully",
    "data": {
      "fileKey": "uploads/1234567890-filename.jpg",
      "fileName": "filename.jpg",
      "fileSize": 123456,
      "mimeType": "image/jpeg",
      "signedUrl": "https://bucket.s3.region.amazonaws.com/...",
      "expiresIn": 3600
    }
  }
  ```

#### Upload Multiple Files
- **POST** `/api/upload/multiple`
- **Content-Type:** `multipart/form-data`
- **Body:** `files` (form field, max 10 files)
- **Response:** Array of uploaded file objects

#### Get Signed URL
- **POST** `/api/get-signed-url`
- **Content-Type:** `application/json`
- **Body:**
  ```json
  {
    "fileKey": "uploads/1234567890-filename.jpg",
    "expiresIn": 3600
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "fileKey": "uploads/1234567890-filename.jpg",
      "signedUrl": "https://bucket.s3.region.amazonaws.com/...",
      "expiresIn": 3600,
      "expiresAt": "2026-01-10T15:45:44.000Z"
    }
  }
  ```

#### Fetch File Content Directly
- **GET** `/api/files/:key`
- **Description:** Streams the actual file content directly from S3.
- **Example:** `http://localhost:3000/api/files/uploads/1234567890-filename.jpg`

### Live Messaging (SQS + Socket.io)
- **Dashboard URL:** `http://localhost:3000/dashboard`
- **Description:** A real-time dashboard that polls messages from SQS and broadcasts them via Socket.io.
- **Send Message API:**
  - **POST** `/api/messages`
  - **Body:** `{ "text": "Hello World", "topic": "updates" }`

---

## AWS SQS Setup

1. **Create an SQS Queue:**
   - Go to AWS Console → SQS
   - Click "Create queue"
   - Select **Standard** or **FIFO** (standard recommended for this demo)
   - Name: `my-app-messages`
   - Copy the **Queue URL** to `AWS_SQS_QUEUE_URL` in `.env`

2. **Permissions (IAM):**
   - Ensure your IAM user has `AmazonSQSFullAccess` or a custom policy with `sqs:SendMessage`, `sqs:ReceiveMessage`, and `sqs:DeleteMessage`.


---

## Cloud Deployment (AWS ECS)

This application is configured for automated deployment to **AWS ECS (Fargate)** using **GitHub Actions**.

### 1. Prerequisites
- **Amazon ECR Repository**: Create a repository named `express-app-repo`.
- **Amazon ECS Cluster**: Create a cluster named `express-app-cluster`.
- **Amazon ECS Service**: Create a Fargate service named `express-app-service` within the cluster.
- **IAM Roles**: Ensure `ecsTaskExecutionRole` exists.

### 2. GitHub Secrets
Add the following secrets to your GitHub repository:
- `AWS_ACCESS_KEY_ID`: Your AWS access key.
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key.

### 3. Pipeline Configuration
The pipeline is defined in `.github/workflows/aws-deploy.yml`. It triggers on every push to the `main` branch:
1. Builds the Docker image.
2. Pushes the image to **Amazon ECR**.
3. Deploys the new image to the **ECS Service**.

---

## Project Structure

```
expess-app/
├── index.js          # Main application file
├── s3Config.js       # AWS S3 configuration and utilities
├── uploadRoutes.js   # File upload API routes
├── package.json      # Project dependencies and scripts
├── .env              # Environment variables (not in git)
├── .env.example      # Environment variables template
├── .gitignore        # Git ignore rules
└── README.md         # This file
```

## Testing the API

### Using curl

```bash
# Get welcome message
curl http://localhost:3000/

# Health check
curl http://localhost:3000/health

# Get users
curl http://localhost:3000/api/users

# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'

# Upload a file to S3
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/your/file.jpg"

# Upload multiple files to S3
curl -X POST http://localhost:3000/api/upload/multiple \
  -F "files=@/path/to/file1.jpg" \
  -F "files=@/path/to/file2.pdf"

# Get signed URL for a file
curl -X POST http://localhost:3000/api/get-signed-url \
  -H "Content-Type: application/json" \
  -d '{"fileKey":"uploads/1234567890-filename.jpg","expiresIn":7200}'
```

### Using a browser

Simply navigate to:
- http://localhost:3000/
- http://localhost:3000/health
- http://localhost:3000/api/users

## Author

Mayur Adlak

## License

ISC
