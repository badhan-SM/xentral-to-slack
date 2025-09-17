#!/bin/bash

# Google Cloud Run Deployment Script for xentral-to-slack
# Make sure you have gcloud CLI installed and authenticated

set -e

# Configuration
PROJECT_ID="xentral-slack-1758109193"  # Your Google Cloud project ID
SERVICE_NAME="xentral-to-slack"
REGION="europe-west1"  # Change if you prefer another region
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment to Google Cloud Run${NC}"

# Check if PROJECT_ID is set
if [ "$PROJECT_ID" == "your-project-id" ]; then
    echo -e "${RED}❌ Please edit this script and set your PROJECT_ID${NC}"
    exit 1
fi

# Set the project
echo -e "${YELLOW}Setting project to $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build the container image
echo -e "${YELLOW}Building container image...${NC}"
gcloud builds submit --tag $IMAGE_NAME

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
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
echo -e "${YELLOW}⚠️  Don't forget to set environment variables:${NC}"
echo -e "   1. Go to Cloud Console > Cloud Run > $SERVICE_NAME > Edit & Deploy New Revision"
echo -e "   2. Click on 'Variables & Secrets' tab"
echo -e "   3. Add your environment variables:"
echo -e "      - SLACK_WEBHOOK_URL"
echo -e "      - XENTRAL_API_TOKEN"
echo -e "      - XENTRAL_CUSTOMER_URL_TEMPLATE"
echo ""
echo -e "${GREEN}Use this URL in Xentral webhook configuration: ${SERVICE_URL}/xentral${NC}"