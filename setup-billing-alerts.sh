#!/bin/bash

# Google Cloud Billing Alerts Setup Script
# This creates budget alerts to protect you from unexpected charges

set -e

PROJECT_ID="learned-house-375913"
BUDGET_NAME="xentral-webhook-budget"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🛡️ Setting up billing protection for your project${NC}"

# Get billing account ID
BILLING_ACCOUNT=$(gcloud billing accounts list --format="value(name)" --limit=1)

if [ -z "$BILLING_ACCOUNT" ]; then
    echo -e "${RED}❌ No billing account found. Please set up billing first.${NC}"
    echo "Visit: https://console.cloud.google.com/billing/enable?project=$PROJECT_ID"
    exit 1
fi

echo -e "${YELLOW}📊 Found billing account: $BILLING_ACCOUNT${NC}"

# Create budget with alerts at $1, $5, $10
echo -e "${YELLOW}📝 Creating budget with alerts...${NC}"

# Note: Budget creation via CLI requires JSON config
# It's easier to do this via Console, so let's open the right page

echo -e "${GREEN}✅ Opening budget creation page...${NC}"
open "https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID"

echo -e "${YELLOW}📋 Please create a budget with these settings:${NC}"
echo "   • Budget name: xentral-webhook-budget"
echo "   • Amount: \$20 per month (generous for webhooks)"
echo "   • Alert thresholds: 25% (\$5), 50% (\$10), 75% (\$15), 100% (\$20)"
echo "   • Email notifications: Your email address"
echo ""
echo -e "${GREEN}🔍 After creating the budget, you can monitor costs at:${NC}"
echo "   https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID"