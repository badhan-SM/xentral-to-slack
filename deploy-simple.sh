#!/bin/bash

# Simple deployment without Cloud Build
set -e

PROJECT_ID="xentral-slack-1758109193"
SERVICE_NAME="xentral-to-slack"
REGION="europe-west1"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting simple deployment to Google Cloud Run${NC}"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Create Artifact Registry repository
echo -e "${YELLOW}Creating Artifact Registry repository...${NC}"
gcloud artifacts repositories create $SERVICE_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker repository for xentral-to-slack" || true

# Configure docker for Artifact Registry
echo -e "${YELLOW}Configuring Docker authentication...${NC}"
gcloud auth configure-docker $REGION-docker.pkg.dev

# Build image locally and push
IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/$SERVICE_NAME/$SERVICE_NAME:latest"

echo -e "${YELLOW}Building Docker image locally...${NC}"
docker build -t $IMAGE_URL .

echo -e "${YELLOW}Pushing image to Artifact Registry...${NC}"
docker push $IMAGE_URL

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
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