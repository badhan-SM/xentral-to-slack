// index.js
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Joi = require("joi");
const winston = require("winston");
const { IncomingWebhook } = require("@slack/webhook");
require("dotenv").config();

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Use global fetch if Node 18+, otherwise fall back to node-fetch
const fetchLib = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Slack webhook
let slack;
if (process.env.SLACK_WEBHOOK_URL) {
  slack = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
  logger.info('Slack webhook initialized successfully');
} else {
  logger.warn('SLACK_WEBHOOK_URL not set - webhook functionality will be disabled');
}

// Validation schemas
const webhookSchema = Joi.object({
  type: Joi.string().required(),
  body: Joi.object().required(),
  timestamp: Joi.string().optional()
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000
};

// ---- Utility Functions ----

// Retry helper with exponential backoff
async function retryWithBackoff(fn, maxRetries = RETRY_CONFIG.maxRetries) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelay
      );
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, { error: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// Fetch customer data from Xentral API
async function getCustomerData(customerId) {
  try {
    if (!customerId) return null;
    
    const tmpl = process.env.XENTRAL_CUSTOMER_URL_TEMPLATE;
    const token = process.env.XENTRAL_API_TOKEN;
    
    if (!tmpl || !token) {
      logger.warn('Missing Xentral API configuration');
      return null;
    }

    const url = tmpl.replace("{id}", String(customerId));
    
    return await retryWithBackoff(async () => {
      const resp = await fetchLib(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          'User-Agent': 'xentral-to-slack/1.0.0'
        },
        timeout: 10000
      });
      
      if (!resp.ok) {
        const errorText = await resp.text();
        logger.error('Xentral API request failed', {
          status: resp.status,
          statusText: resp.statusText,
          response: errorText,
          customerId
        });
        throw new Error(`Xentral API error: ${resp.status} ${resp.statusText}`);
      }
      
      const data = await resp.json();
      logger.info('Successfully fetched customer data', { customerId });
      
      // Xentral API returns data in {data: {...}} format
      const customerInfo = data?.data || data;
      
      return {
        name: customerInfo?.name || customerInfo?.firmenname || customerInfo?.fullname || customerInfo?.company || customerInfo?.adresse?.name || null,
        email: customerInfo?.email || customerInfo?.adresse?.email || null,
        phone: customerInfo?.telefon || customerInfo?.phone || customerInfo?.adresse?.telefon || null,
        address: customerInfo?.adresse || null
      };
    });
  } catch (error) {
    logger.error('Customer lookup failed', { customerId, error: error.message });
    return null;
  }
}

// ---- Event Handlers ----

const eventHandlers = {
  'com.xentral.customers.created.v2': async (body) => {
    const customerId = body?.customerId || body?.id || body?.adresseId || body?.addressId;
    const createdAt = body?.createdAt || body?.created_at || new Date().toISOString();
    
    // Log the full webhook body to see what data Xentral sends
    logger.info('Full webhook body from Xentral', { body: JSON.stringify(body, null, 2) });
    
    // Get customer name from various possible fields
    let customerName = body?.name || body?.customer?.name || body?.firmenname || body?.fullname || body?.company || body?.customerName;
    
    // Also check nested objects
    if (!customerName && body?.data) {
      customerName = body.data.name || body.data.customer?.name || body.data.firmenname;
    }
    
    // If still no name and we have ID, try to get from API
    if (!customerName && customerId) {
      const apiData = await getCustomerData(customerId);
      if (apiData && apiData.name) {
        customerName = apiData.name;
      }
    }
    
    return {
      text: `New Customer Created #${customerId}${customerName ? ` – ${customerName}` : ''}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "New Customer Created" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Customer ID:*\n${customerId || "—"}` },
            { type: "mrkdwn", text: `*Name:*\n${customerName || "—"}` },
            { type: "mrkdwn", text: `*Created At:*\n${createdAt}` }
          ]
        }
      ]
    };
  },
  
  'order.created': async (body) => {
    const orderId = body?.id || body?.orderId;
    const customerName = body?.customer?.name || body?.customerName;
    const total = body?.total || body?.amount;
    const createdAt = body?.createdAt || body?.created_at || new Date().toISOString();
    
    return {
      text: `📦 New Order Created${orderId ? ` #${orderId}` : ''}${customerName ? ` for ${customerName}` : ''}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "📦 New Order Created" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Order ID:*\n${orderId || "—"}` },
            { type: "mrkdwn", text: `*Customer:*\n${customerName || "—"}` },
            { type: "mrkdwn", text: `*Total:*\n${total ? `€${total}` : "—"}` },
            { type: "mrkdwn", text: `*Created At:*\n${createdAt}` }
          ]
        }
      ]
    };
  },
  
  'invoice.created': async (body) => {
    const invoiceId = body?.id || body?.invoiceId;
    const customerName = body?.customer?.name || body?.customerName;
    const amount = body?.amount || body?.total;
    const createdAt = body?.createdAt || body?.created_at || new Date().toISOString();
    
    return {
      text: `🧾 New Invoice Created${invoiceId ? ` #${invoiceId}` : ''}${customerName ? ` for ${customerName}` : ''}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "🧾 New Invoice Created" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Invoice ID:*\n${invoiceId || "—"}` },
            { type: "mrkdwn", text: `*Customer:*\n${customerName || "—"}` },
            { type: "mrkdwn", text: `*Amount:*\n${amount ? `€${amount}` : "—"}` },
            { type: "mrkdwn", text: `*Created At:*\n${createdAt}` }
          ]
        }
      ]
    };
  },
  
  'payment.received': async (body) => {
    const paymentId = body?.id || body?.paymentId;
    const customerName = body?.customer?.name || body?.customerName;
    const amount = body?.amount || body?.total;
    const method = body?.method || body?.paymentMethod;
    const createdAt = body?.createdAt || body?.created_at || new Date().toISOString();
    
    return {
      text: `💰 Payment Received${paymentId ? ` #${paymentId}` : ''}${customerName ? ` from ${customerName}` : ''}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "💰 Payment Received" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Payment ID:*\n${paymentId || "—"}` },
            { type: "mrkdwn", text: `*Customer:*\n${customerName || "—"}` },
            { type: "mrkdwn", text: `*Amount:*\n${amount ? `€${amount}` : "—"}` },
            { type: "mrkdwn", text: `*Method:*\n${method || "—"}` },
            { type: "mrkdwn", text: `*Received At:*\n${createdAt}` }
          ]
        }
      ]
    };
  },
  
  'report.exported': async (body) => {
    const reportId = body?.id || body?.reportId;
    const reportName = body?.name || body?.reportName || body?.title;
    const reportType = body?.type || body?.reportType;
    const exportedBy = body?.user || body?.exportedBy || body?.username;
    const exportFormat = body?.format || body?.exportFormat || 'Unknown';
    const createdAt = body?.createdAt || body?.created_at || new Date().toISOString();
    
    return {
      text: `📊 Report Exported${reportName ? `: ${reportName}` : ''}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "📊 Report Exported" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Report Name:*\n${reportName || "—"}` },
            { type: "mrkdwn", text: `*Report Type:*\n${reportType || "—"}` },
            { type: "mrkdwn", text: `*Format:*\n${exportFormat}` },
            { type: "mrkdwn", text: `*Exported By:*\n${exportedBy || "—"}` },
            { type: "mrkdwn", text: `*Exported At:*\n${createdAt}` }
          ]
        }
      ]
    };
  },
  
  'report.viewed': async (body) => {
    const reportId = body?.id || body?.reportId;
    const reportName = body?.name || body?.reportName || body?.title;
    const viewedBy = body?.user || body?.viewedBy || body?.username;
    const createdAt = body?.createdAt || body?.created_at || new Date().toISOString();
    
    return {
      text: `👁️ Report Viewed${reportName ? `: ${reportName}` : ''}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "👁️ Report Viewed" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Report Name:*\n${reportName || "—"}` },
            { type: "mrkdwn", text: `*Viewed By:*\n${viewedBy || "—"}` },
            { type: "mrkdwn", text: `*Viewed At:*\n${createdAt}` }
          ]
        }
      ]
    };
  },
  
  'exporter.executed': async (body) => {
    const exporterId = body?.id || body?.exporterId;
    const exporterName = body?.name || body?.exporterName || body?.title;
    const executedBy = body?.user || body?.executedBy || body?.username;
    const status = body?.status || 'completed';
    const createdAt = body?.createdAt || body?.created_at || new Date().toISOString();
    
    return {
      text: `📤 Exporter Executed${exporterName ? `: ${exporterName}` : ''}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "📤 Exporter Executed" } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Exporter Name:*\n${exporterName || "—"}` },
            { type: "mrkdwn", text: `*Executed By:*\n${executedBy || "—"}` },
            { type: "mrkdwn", text: `*Status:*\n${status}` },
            { type: "mrkdwn", text: `*Executed At:*\n${createdAt}` }
          ]
        }
      ]
    };
  }
};

// Send message to Slack with retry logic
async function sendSlackMessage(message) {
  if (!slack) {
    logger.warn('Slack not configured - skipping message send', { preview: message.text });
    return;
  }
  
  return await retryWithBackoff(async () => {
    logger.info('Sending message to Slack', { preview: message.text });
    await slack.send(message);
    logger.info('Successfully sent message to Slack');
  });
}

// ---- Webhook endpoint from Xentral ----
app.post("/xentral", async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  logger.info('Received webhook request', { requestId, body: req.body });
  
  try {
    // Validate request body
    const { error, value } = webhookSchema.validate(req.body);
    if (error) {
      logger.warn('Invalid webhook payload', { requestId, error: error.details });
      return res.status(400).json({ error: 'Invalid payload', details: error.details });
    }
    
    const { type, body } = value;
    
    // Log the event type for debugging
    logger.info('Processing webhook event', { type, eventTypes: Object.keys(eventHandlers) });
    
    // Check if we have a handler for this event type
    const handler = eventHandlers[type] || eventHandlers['customer.created']; // Default fallback
    
    if (!handler && type !== 'customer.created') {
      logger.warn('No handler for event type', { requestId, type });
      return res.status(200).json({ message: 'Event type not supported', type });
    }
    
    // Process the event
    const message = await handler(body);
    await sendSlackMessage(message);
    
    const duration = Date.now() - startTime;
    logger.info('Webhook processed successfully', { requestId, type, duration });
    
    res.status(200).json({ success: true, requestId });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Webhook processing failed', { 
      requestId, 
      error: error.message, 
      stack: error.stack,
      duration
    });
    
    res.status(500).json({ 
      error: 'Internal server error', 
      requestId,
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ---- Additional Routes ----

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    uptime: process.uptime()
  });
});

// Root endpoint
app.get("/", (_req, res) => {
  res.status(200).json({
    service: 'xentral-to-slack',
    version: require('./package.json').version,
    endpoints: {
      webhook: '/xentral',
      health: '/health'
    }
  });
});

// Test endpoint for development
if (process.env.NODE_ENV === 'development') {
  app.post("/test", async (req, res) => {
    try {
      const testMessage = {
        text: '🧪 Test Message from Xentral-to-Slack',
        blocks: [
          { type: "header", text: { type: "plain_text", text: "🧪 Test Message" } },
          {
            type: "section",
            text: { type: "mrkdwn", text: "This is a test message to verify the Slack integration is working." }
          }
        ]
      };
      
      await sendSlackMessage(testMessage);
      res.status(200).json({ success: true, message: 'Test message sent successfully' });
    } catch (error) {
      logger.error('Test endpoint failed', { error: error.message });
      res.status(500).json({ error: 'Failed to send test message', details: error.message });
    }
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', { error: error.message, stack: error.stack, url: req.url });
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 Xentral-to-Slack service started`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});