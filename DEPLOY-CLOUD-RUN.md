# 🚀 Deploy to Google Cloud Run - Step by Step

This guide will help you deploy your xentral-to-slack service to Google Cloud Run and get a public URL for your Xentral webhooks.

## Prerequisites

1. **Google Cloud Account** (with billing enabled - but you'll stay in free tier)
2. **gcloud CLI** installed on your machine

## Step 1: Install Google Cloud CLI

If you haven't installed gcloud CLI yet:

**macOS:**
```bash
brew install --cask google-cloud-sdk
```

Or download from: https://cloud.google.com/sdk/docs/install

## Step 2: Initial Setup

1. **Login to Google Cloud:**
```bash
gcloud auth login
```

2. **Create a new project (or use existing):**
```bash
# List your projects
gcloud projects list

# Create new project (optional)
gcloud projects create xentral-slack-webhook --name="Xentral Slack Webhook"

# Set your project ID (replace with your actual project ID)
export PROJECT_ID="xentral-slack-webhook"
gcloud config set project $PROJECT_ID
```

3. **Enable billing** (required for Cloud Run):
   - Go to https://console.cloud.google.com/billing
   - Link your project to a billing account

## Step 3: Quick Deploy (Easiest Method)

I've created a deployment script for you. Just run:

```bash
# 1. Edit the deploy script and change PROJECT_ID
nano deploy-to-cloud-run.sh
# Change line: PROJECT_ID="your-project-id" to your actual project ID

# 2. Run the deployment
./deploy-to-cloud-run.sh
```

## Step 4: Configure Environment Variables

After deployment, you need to set your secret environment variables:

### Option A: Using Cloud Console (Easier)
1. Go to https://console.cloud.google.com/run
2. Click on `xentral-to-slack` service
3. Click **"Edit & Deploy New Revision"**
4. Go to **"Variables & Secrets"** tab
5. Add these variables:
   - `SLACK_WEBHOOK_URL` = Your Slack webhook URL
   - `XENTRAL_API_TOKEN` = Your Xentral API token
   - `XENTRAL_CUSTOMER_URL_TEMPLATE` = https://your-xentral.com/api/v2/adressen/{id}
6. Click **"Deploy"**

### Option B: Using Command Line
```bash
gcloud run services update xentral-to-slack \
  --update-env-vars="SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  --update-env-vars="XENTRAL_API_TOKEN=your-xentral-token" \
  --update-env-vars="XENTRAL_CUSTOMER_URL_TEMPLATE=https://your-xentral.com/api/v2/adressen/{id}" \
  --region=europe-west1
```

## Step 5: Get Your Webhook URL

After deployment, you'll get a URL like:
```
https://xentral-to-slack-abc123-ey.a.run.app
```

Your Xentral webhook URL will be:
```
https://xentral-to-slack-abc123-ey.a.run.app/xentral
```

## Step 6: Configure Xentral Webhook

1. Go to your Xentral admin panel
2. Navigate to webhooks settings
3. Create a new webhook:
   - **Name:** Send Report to Xentral
   - **URL:** `https://your-cloud-run-url.a.run.app/xentral`
   - **Signature Key:** Save this for later (optional security feature)

## Manual Deployment (Alternative)

If the script doesn't work, here are the manual commands:

```bash
# 1. Set your project
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# 2. Enable APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com

# 3. Build container
gcloud builds submit --tag gcr.io/$PROJECT_ID/xentral-to-slack

# 4. Deploy
gcloud run deploy xentral-to-slack \
  --image gcr.io/$PROJECT_ID/xentral-to-slack \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080
```

## Testing Your Deployment

Test if your service is working:

```bash
# Health check
curl https://your-cloud-run-url.a.run.app/health

# Test webhook (in development mode)
curl -X POST https://your-cloud-run-url.a.run.app/test
```

## Monitoring

View logs:
```bash
gcloud run services logs read xentral-to-slack --region=europe-west1
```

Or use Cloud Console: https://console.cloud.google.com/logs

## Costs

With Google Cloud Run free tier:
- 2 million requests/month free
- 360,000 GB-seconds of memory free
- 180,000 vCPU-seconds of compute free

For webhooks, you'll likely stay well within free limits!

## Troubleshooting

**Service not accessible:**
- Make sure you used `--allow-unauthenticated` flag
- Check if APIs are enabled

**Environment variables not working:**
- Redeploy after adding environment variables
- Check logs for error messages

**Webhook not received:**
- Test with curl first
- Check Cloud Run logs
- Verify Xentral webhook configuration

## Support

Need help? Check:
1. Cloud Run logs in Google Console
2. The README.md file
3. Google Cloud Run documentation