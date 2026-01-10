#!/bin/bash

# AWS Cleanup Script
# Removes all resources created by aws-deploy.sh

set -e

APP_NAME="omegle-backend"
REGION="us-east-1"

echo "🗑️  Starting cleanup..."
echo "⚠️  This will delete all resources for $APP_NAME"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelled"
  exit 0
fi

# Check what's deployed
echo "Checking for deployed resources..."

# Clean up App Runner
if aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME']" --output text 2>/dev/null | grep -q .; then
  echo "Deleting App Runner service..."
  SERVICE_ARN=$(aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceArn" --output text)
  aws apprunner delete-service --service-arn $SERVICE_ARN --region $REGION
  echo "✅ App Runner service deleted"
fi

# Clean up ECS
if aws ecs describe-clusters --clusters $APP_NAME-cluster --region $REGION 2>/dev/null | grep -q "ACTIVE"; then
  echo "Deleting ECS resources..."
  
  # Delete service
  aws ecs update-service \
    --cluster $APP_NAME-cluster \
    --service $APP_NAME-service \
    --desired-count 0 \
    --region $REGION 2>/dev/null || true
  
  aws ecs delete-service \
    --cluster $APP_NAME-cluster \
    --service $APP_NAME-service \
    --force \
    --region $REGION 2>/dev/null || true
  
  # Delete cluster
  aws ecs delete-cluster --cluster $APP_NAME-cluster --region $REGION 2>/dev/null || true
  
  # Delete log group
  aws logs delete-log-group --log-group-name /ecs/$APP_NAME --region $REGION 2>/dev/null || true
  
  echo "✅ ECS resources deleted"
fi

# Clean up EC2
INSTANCE_IDS=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$APP_NAME" "Name=instance-state-name,Values=running,stopped" \
  --query "Reservations[].Instances[].InstanceId" \
  --output text \
  --region $REGION 2>/dev/null)

if [ ! -z "$INSTANCE_IDS" ]; then
  echo "Terminating EC2 instances..."
  aws ec2 terminate-instances --instance-ids $INSTANCE_IDS --region $REGION
  echo "✅ EC2 instances terminated"
fi

# Delete security groups
SG_IDS=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$APP_NAME-sg" \
  --query "SecurityGroups[].GroupId" \
  --output text \
  --region $REGION 2>/dev/null)

if [ ! -z "$SG_IDS" ]; then
  echo "Waiting for instances to terminate..."
  sleep 30
  for SG_ID in $SG_IDS; do
    echo "Deleting security group: $SG_ID"
    aws ec2 delete-security-group --group-id $SG_ID --region $REGION 2>/dev/null || echo "Security group in use, will be deleted after resources are cleaned"
  done
fi

# Delete key pair
aws ec2 delete-key-pair --key-name $APP_NAME-key --region $REGION 2>/dev/null || true
rm -f $APP_NAME-key.pem

echo "✅ Cleanup complete!"
