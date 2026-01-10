#!/bin/bash

# AWS Automatic Deployment Script for Omegle Backend
# Prerequisites: AWS CLI installed and configured with credentials

set -e

echo "🚀 Starting AWS Deployment..."

# Configuration
DOCKER_IMAGE="utkarsh2568/omegle-backend:v1.1"
APP_NAME="omegle-backend"
REGION="us-east-1"  # Change to your preferred region
PORT="3001"

# Choose deployment method
echo "Select deployment method:"
echo "1) AWS App Runner (Simplest - Fully Managed)"
echo "2) AWS ECS Fargate (More Control)"
echo "3) AWS EC2 with Docker (Full Control)"
read -p "Enter choice (1-3): " DEPLOYMENT_METHOD

case $DEPLOYMENT_METHOD in
  1)
    echo "📦 Deploying to AWS App Runner..."
    
    # Create App Runner service
    aws apprunner create-service \
      --service-name $APP_NAME \
      --source-configuration "{
        \"ImageRepository\": {
          \"ImageIdentifier\": \"$DOCKER_IMAGE\",
          \"ImageRepositoryType\": \"ECR_PUBLIC\",
          \"ImageConfiguration\": {
            \"Port\": \"$PORT\",
            \"RuntimeEnvironmentVariables\": {
              \"NODE_ENV\": \"production\",
              \"PORT\": \"$PORT\"
            }
          }
        },
        \"AutoDeploymentsEnabled\": true
      }" \
      --instance-configuration "{
        \"Cpu\": \"1024\",
        \"Memory\": \"2048\"
      }" \
      --region $REGION
    
    echo "✅ App Runner deployment initiated!"
    echo "Getting service URL..."
    sleep 10
    
    SERVICE_URL=$(aws apprunner describe-service \
      --service-arn $(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceArn" --output text --region $REGION) \
      --query "Service.ServiceUrl" \
      --output text \
      --region $REGION)
    
    echo "🌐 Your backend is deployed at: https://$SERVICE_URL"
    ;;
    
  2)
    echo "📦 Deploying to AWS ECS Fargate..."
    
    # Create ECS cluster
    aws ecs create-cluster --cluster-name $APP_NAME-cluster --region $REGION
    
    # Register task definition
    cat > task-definition.json <<EOF
{
  "family": "$APP_NAME",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "$APP_NAME",
    "image": "$DOCKER_IMAGE",
    "portMappings": [{
      "containerPort": $PORT,
      "protocol": "tcp"
    }],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "$PORT"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/$APP_NAME",
        "awslogs-region": "$REGION",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
EOF
    
    # Create CloudWatch log group
    aws logs create-log-group --log-group-name /ecs/$APP_NAME --region $REGION || true
    
    # Register task
    TASK_ARN=$(aws ecs register-task-definition \
      --cli-input-json file://task-definition.json \
      --region $REGION \
      --query "taskDefinition.taskDefinitionArn" \
      --output text)
    
    echo "Task definition registered: $TASK_ARN"
    
    # Get default VPC and subnets
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text --region $REGION)
    SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text --region $REGION | tr '\t' ',')
    
    # Create security group
    SG_ID=$(aws ec2 create-security-group \
      --group-name $APP_NAME-sg \
      --description "Security group for $APP_NAME" \
      --vpc-id $VPC_ID \
      --region $REGION \
      --query "GroupId" \
      --output text)
    
    # Allow inbound traffic on port
    aws ec2 authorize-security-group-ingress \
      --group-id $SG_ID \
      --protocol tcp \
      --port $PORT \
      --cidr 0.0.0.0/0 \
      --region $REGION
    
    # Create ECS service
    aws ecs create-service \
      --cluster $APP_NAME-cluster \
      --service-name $APP_NAME-service \
      --task-definition $APP_NAME \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
      --region $REGION
    
    echo "✅ ECS Fargate deployment initiated!"
    echo "Note: It may take a few minutes for the service to start"
    
    # Get public IP
    echo "Waiting for task to start..."
    sleep 30
    TASK_ARN=$(aws ecs list-tasks --cluster $APP_NAME-cluster --service-name $APP_NAME-service --region $REGION --query "taskArns[0]" --output text)
    ENI_ID=$(aws ecs describe-tasks --cluster $APP_NAME-cluster --tasks $TASK_ARN --region $REGION --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text)
    PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region $REGION --query "NetworkInterfaces[0].Association.PublicIp" --output text)
    
    echo "🌐 Your backend is deployed at: http://$PUBLIC_IP:$PORT"
    ;;
    
  3)
    echo "📦 Deploying to AWS EC2..."
    
    # Create key pair
    aws ec2 create-key-pair \
      --key-name $APP_NAME-key \
      --query 'KeyMaterial' \
      --output text \
      --region $REGION > $APP_NAME-key.pem
    chmod 400 $APP_NAME-key.pem
    
    # Get default VPC
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text --region $REGION)
    
    # Create security group
    SG_ID=$(aws ec2 create-security-group \
      --group-name $APP_NAME-sg \
      --description "Security group for $APP_NAME" \
      --vpc-id $VPC_ID \
      --region $REGION \
      --query "GroupId" \
      --output text)
    
    # Allow SSH and app port
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0 --region $REGION
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port $PORT --cidr 0.0.0.0/0 --region $REGION
    
    # User data script
    cat > user-data.sh <<'EOF'
#!/bin/bash
yum update -y
yum install -y docker
service docker start
usermod -a -G docker ec2-user

# Pull and run container
docker pull utkarsh2568/omegle-backend:v1.1
docker run -d -p 3001:3001 --name omegle-backend --restart unless-stopped utkarsh2568/omegle-backend:v1.1
EOF
    
    # Launch EC2 instance
    INSTANCE_ID=$(aws ec2 run-instances \
      --image-id $(aws ec2 describe-images --owners amazon --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" --output text --region $REGION) \
      --instance-type t3.micro \
      --key-name $APP_NAME-key \
      --security-group-ids $SG_ID \
      --user-data file://user-data.sh \
      --region $REGION \
      --query "Instances[0].InstanceId" \
      --output text)
    
    echo "✅ EC2 instance launching: $INSTANCE_ID"
    echo "Waiting for instance to start..."
    
    aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION
    
    PUBLIC_IP=$(aws ec2 describe-instances \
      --instance-ids $INSTANCE_ID \
      --region $REGION \
      --query "Reservations[0].Instances[0].PublicIpAddress" \
      --output text)
    
    echo "🌐 Your backend is deployed at: http://$PUBLIC_IP:$PORT"
    echo "🔑 SSH access: ssh -i $APP_NAME-key.pem ec2-user@$PUBLIC_IP"
    ;;
    
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo "
✅ Deployment Complete!

Next steps:
1. Update frontend VITE_SOCKET_URL to point to your backend URL
2. Configure CORS in backend with FRONTEND_URL environment variable
3. Set up custom domain (optional)
4. Configure SSL/TLS certificate

To monitor your deployment:
- CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/
- AWS Console: https://console.aws.amazon.com/

To undeploy, run: ./aws-undeploy.sh
"
