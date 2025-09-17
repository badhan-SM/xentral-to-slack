# Xentral to Slack Integration

A robust Node.js service that receives webhooks from Xentral ERP and forwards formatted notifications to Slack channels.

## Features

- 🔐 **Secure**: Rate limiting, input validation, and security headers
- 🔄 **Reliable**: Automatic retry logic with exponential backoff
- 📊 **Comprehensive Logging**: Structured logging with Winston
- 🎯 **Multiple Event Types**: Support for customers, orders, invoices, and payments
- ⚡ **Fast**: Optimized for high-throughput webhook processing
- 🛠️ **Developer Friendly**: Test endpoints and detailed error messages
- 📈 **Production Ready**: Health checks, graceful shutdown, and monitoring

## Supported Event Types

| Event Type | Description | Slack Message |
|------------|-------------|---------------|
| `customer.created` | New customer registration | 🎉 New Customer Created |
| `order.created` | New order placed | 📦 New Order Created |
| `invoice.created` | New invoice generated | 🧾 New Invoice Created |
| `payment.received` | Payment received | 💰 Payment Received |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
XENTRAL_API_TOKEN=your_xentral_api_token_here
XENTRAL_CUSTOMER_URL_TEMPLATE=https://your-xentral-instance.com/api/v2/adressen/{id}

# Optional
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Start the Service

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## API Endpoints

### Webhook Endpoint
- **POST** `/xentral` - Receives webhooks from Xentral
- **Headers:** `Content-Type: application/json`
- **Payload:**
  ```json
  {
    "type": "customer.created",
    "body": {
      "id": 12345,
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2023-12-01T10:00:00Z"
    }
  }
  ```

### Utility Endpoints
- **GET** `/` - Service information
- **GET** `/health` - Health check for monitoring
- **POST** `/test` - Send test message to Slack (development only)

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SLACK_WEBHOOK_URL` | Yes | Slack incoming webhook URL | `https://hooks.slack.com/services/...` |
| `XENTRAL_API_TOKEN` | No* | Xentral API token for customer lookup | `your_api_token` |
| `XENTRAL_CUSTOMER_URL_TEMPLATE` | No* | URL template for customer API | `https://example.com/api/v2/adressen/{id}` |
| `PORT` | No | Server port | `3000` |
| `NODE_ENV` | No | Environment mode | `production` |
| `LOG_LEVEL` | No | Logging level | `info` |

*Required for customer data enrichment from Xentral API

## Xentral Webhook Configuration

1. Log in to your Xentral admin panel
2. Navigate to **Settings** → **Webhooks**
3. Create a new webhook with:
   - **URL:** `https://your-domain.com/xentral`
   - **Events:** Select the events you want to track
   - **Format:** JSON
   - **Method:** POST

## Slack Setup

1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app for your workspace
3. Navigate to **Incoming Webhooks**
4. Create a webhook for your desired channel
5. Copy the webhook URL to your `.env` file

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Joi schema validation for all requests
- **Security Headers**: Helmet.js for common security headers
- **Request Size Limits**: 10MB maximum payload size
- **Error Sanitization**: Sensitive data excluded from error responses

## Monitoring & Logging

### Health Check
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600.123
}
```

### Logs
Structured JSON logs include:
- Request IDs for tracing
- Processing duration
- Error details with stack traces
- API call success/failure

## Development

### Testing the Integration

Send a test message to Slack:
```bash
curl -X POST http://localhost:3000/test
```

### Mock Webhook Data

Test with sample webhook data:
```bash
curl -X POST http://localhost:3000/xentral \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "customer.created",
    "body": {
      "id": 12345,
      "name": "Test Customer",
      "email": "test@example.com",
      "createdAt": "2023-12-01T10:00:00Z"
    }
  }'
```

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests (placeholder)

## Deployment

### Docker (Recommended)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t xentral-to-slack .
docker run -p 3000:3000 --env-file .env xentral-to-slack
```

### PM2 (Process Manager)

```bash
npm install -g pm2
pm2 start index.js --name xentral-to-slack
pm2 startup
pm2 save
```

### Environment-specific Considerations

**Production:**
- Set `NODE_ENV=production`
- Use `LOG_LEVEL=warn` or `error`
- Enable SSL/TLS termination
- Set up log aggregation
- Configure monitoring alerts

## Troubleshooting

### Common Issues

**Webhook not received:**
- Check Xentral webhook configuration
- Verify the endpoint URL is accessible
- Check firewall/proxy settings

**Slack messages not sent:**
- Verify `SLACK_WEBHOOK_URL` is correct
- Check Slack app permissions
- Review application logs for errors

**Customer data not enriched:**
- Ensure `XENTRAL_API_TOKEN` is valid
- Verify `XENTRAL_CUSTOMER_URL_TEMPLATE` format
- Check Xentral API permissions

### Debugging

Enable debug logging:
```env
LOG_LEVEL=debug
```

Check logs for detailed request/response information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC License - See LICENSE file for details

## Moving from Sandbox to Production

Once you've tested your integration with Xentral sandbox, here's how to move to production:

### Option 1: Update Existing Service (Recommended)

Simply update your current Cloud Run service with production settings:

```bash
gcloud run services update xentral-to-slack \
  --update-env-vars XENTRAL_API_TOKEN='YOUR_PRODUCTION_API_TOKEN' \
  --update-env-vars XENTRAL_CUSTOMER_URL_TEMPLATE='https://YOUR_PRODUCTION_DOMAIN.xentral.biz/api/v1/adressen/{id}' \
  --region europe-west1
```

**Your webhook URL stays the same:**
```
https://xentral-to-slack-XXXXXXXXX-ew.a.run.app/xentral
```

### Option 2: Deploy Separate Production Service

Create a dedicated production service:

```bash
# Deploy new production service
gcloud run deploy xentral-to-slack-prod \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars="SLACK_WEBHOOK_URL=YOUR_SLACK_URL" \
  --set-env-vars="XENTRAL_API_TOKEN=PRODUCTION_TOKEN" \
  --set-env-vars="XENTRAL_CUSTOMER_URL_TEMPLATE=https://PRODUCTION.xentral.biz/api/v1/adressen/{id}" \
  --set-env-vars="NODE_ENV=production"
```

### What You Need for Production:

1. **Production Xentral API Token** - Get from Xentral production environment
2. **Production Xentral Domain** - Usually `https://yourcompany.xentral.biz`
3. **Production Slack Channel** - Create webhook for production notifications

### Steps to Switch:

1. **Get production credentials** from your Xentral admin
2. **Update environment variables** using Option 1 above
3. **Create webhook in production Xentral** using the same webhook URL
4. **Test with a production customer creation**

### Environment-specific Configuration

For different environments, you might want different Slack channels:

```bash
# Sandbox notifications to #test-notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/.../test-channel

# Production notifications to #notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/.../production-channel
```

## Support

For issues and questions:
- Check the troubleshooting section
- Review application logs
- Create an issue in the repository