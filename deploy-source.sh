#!/bin/bash

# Deploy from source without Docker
set -e

PROJECT_ID="xentral-slack-1758109193"
SERVICE_NAME="xentral-to-slack"
REGION="europe-west1"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Deploying from source to Google Cloud Run${NC}"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com

# Deploy directly from source
echo -e "${YELLOW}Deploying from source code...${NC}"
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 256Mi \
    --max-instances 10 \
    --set-env-vars="NODE_ENV=production"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}🔗 Your webhook URL is: ${SERVICE_URL}/xentral${NC}"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to set environment variables in Cloud Console${NC}"
echo -e "${GREEN}Use this URL in Xentral: ${SERVICE_URL}/xentral${NC}"