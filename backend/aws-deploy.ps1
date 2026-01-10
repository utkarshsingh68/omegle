# AWS Automatic Deployment Script for Omegle Backend (PowerShell)
# Prerequisites: AWS CLI installed and configured

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting AWS Deployment..." -ForegroundColor Green

# Configuration
$DOCKER_IMAGE = "utkarsh2568/omegle-backend:v1.1"
$APP_NAME = "omegle-backend"
$REGION = "us-east-1"  # Change to your preferred region
$PORT = "3001"

# Choose deployment method
Write-Host "`nSelect deployment method:" -ForegroundColor Cyan
Write-Host "1) AWS App Runner (Simplest - Fully Managed)" -ForegroundColor Yellow
Write-Host "2) AWS ECS Fargate (More Control)" -ForegroundColor Yellow
Write-Host "3) AWS EC2 with Docker (Full Control)" -ForegroundColor Yellow
$DEPLOYMENT_METHOD = Read-Host "Enter choice (1-3)"

switch ($DEPLOYMENT_METHOD) {
    "1" {
        Write-Host "`n📦 Deploying to AWS App Runner..." -ForegroundColor Green
        
        # Create App Runner service
        $sourceConfig = @{
            ImageRepository = @{
                ImageIdentifier = $DOCKER_IMAGE
                ImageRepositoryType = "ECR_PUBLIC"
                ImageConfiguration = @{
                    Port = $PORT
                    RuntimeEnvironmentVariables = @{
                        NODE_ENV = "production"
                        PORT = $PORT
                    }
                }
            }
            AutoDeploymentsEnabled = $true
        } | ConvertTo-Json -Depth 10 -Compress
        
        $instanceConfig = @{
            Cpu = "1024"
            Memory = "2048"
        } | ConvertTo-Json -Compress
        
        aws apprunner create-service `
            --service-name $APP_NAME `
            --source-configuration $sourceConfig `
            --instance-configuration $instanceConfig `
            --region $REGION
        
        Write-Host "✅ App Runner deployment initiated!" -ForegroundColor Green
        Write-Host "Getting service URL..." -ForegroundColor Cyan
        Start-Sleep -Seconds 15
        
        $serviceArn = aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceArn" --output text
        $serviceUrl = aws apprunner describe-service --service-arn $serviceArn --query "Service.ServiceUrl" --output text --region $REGION
        
        Write-Host "`n🌐 Your backend is deployed at: https://$serviceUrl" -ForegroundColor Green
        Write-Host "`n✅ Copy this URL and update your frontend VITE_SOCKET_URL!" -ForegroundColor Yellow
    }
    
    "2" {
        Write-Host "`n📦 Deploying to AWS ECS Fargate..." -ForegroundColor Green
        
        # Create ECS cluster
        Write-Host "Creating ECS cluster..." -ForegroundColor Cyan
        aws ecs create-cluster --cluster-name "$APP_NAME-cluster" --region $REGION
        
        # Create task definition file
        $taskDef = @{
            family = $APP_NAME
            networkMode = "awsvpc"
            requiresCompatibilities = @("FARGATE")
            cpu = "512"
            memory = "1024"
            containerDefinitions = @(
                @{
                    name = $APP_NAME
                    image = $DOCKER_IMAGE
                    portMappings = @(
                        @{
                            containerPort = [int]$PORT
                            protocol = "tcp"
                        }
                    )
                    environment = @(
                        @{ name = "NODE_ENV"; value = "production" }
                        @{ name = "PORT"; value = $PORT }
                    )
                    logConfiguration = @{
                        logDriver = "awslogs"
                        options = @{
                            "awslogs-group" = "/ecs/$APP_NAME"
                            "awslogs-region" = $REGION
                            "awslogs-stream-prefix" = "ecs"
                        }
                    }
                }
            )
        } | ConvertTo-Json -Depth 10
        
        $taskDef | Out-File -FilePath "task-definition.json" -Encoding utf8
        
        # Create CloudWatch log group
        try {
            aws logs create-log-group --log-group-name "/ecs/$APP_NAME" --region $REGION
        } catch {
            Write-Host "Log group already exists" -ForegroundColor Yellow
        }
        
        # Register task definition
        Write-Host "Registering task definition..." -ForegroundColor Cyan
        $taskArn = aws ecs register-task-definition --cli-input-json file://task-definition.json --region $REGION --query "taskDefinition.taskDefinitionArn" --output text
        Write-Host "Task definition registered: $taskArn" -ForegroundColor Green
        
        # Get default VPC and subnets
        Write-Host "Getting VPC configuration..." -ForegroundColor Cyan
        $vpcId = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text --region $REGION
        $subnetIds = (aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcId" --query "Subnets[*].SubnetId" --output text --region $REGION) -replace '\s+', ','
        
        # Create security group
        Write-Host "Creating security group..." -ForegroundColor Cyan
        $sgId = aws ec2 create-security-group --group-name "$APP_NAME-sg" --description "Security group for $APP_NAME" --vpc-id $vpcId --region $REGION --query "GroupId" --output text
        
        # Allow inbound traffic
        aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port $PORT --cidr 0.0.0.0/0 --region $REGION
        
        # Create ECS service
        Write-Host "Creating ECS service..." -ForegroundColor Cyan
        $networkConfig = "awsvpcConfiguration={subnets=[$subnetIds],securityGroups=[$sgId],assignPublicIp=ENABLED}"
        
        aws ecs create-service `
            --cluster "$APP_NAME-cluster" `
            --service-name "$APP_NAME-service" `
            --task-definition $APP_NAME `
            --desired-count 1 `
            --launch-type FARGATE `
            --network-configuration $networkConfig `
            --region $REGION
        
        Write-Host "✅ ECS Fargate deployment initiated!" -ForegroundColor Green
        Write-Host "Waiting for task to start..." -ForegroundColor Cyan
        Start-Sleep -Seconds 45
        
        # Get public IP
        $taskArn = aws ecs list-tasks --cluster "$APP_NAME-cluster" --service-name "$APP_NAME-service" --region $REGION --query "taskArns[0]" --output text
        $eniId = aws ecs describe-tasks --cluster "$APP_NAME-cluster" --tasks $taskArn --region $REGION --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text
        $publicIp = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region $REGION --query "NetworkInterfaces[0].Association.PublicIp" --output text
        
        Write-Host "`n🌐 Your backend is deployed at: http://${publicIp}:$PORT" -ForegroundColor Green
        Write-Host "`n✅ Copy this URL and update your frontend VITE_SOCKET_URL!" -ForegroundColor Yellow
    }
    
    "3" {
        Write-Host "`n📦 Deploying to AWS EC2..." -ForegroundColor Green
        
        # Create key pair
        Write-Host "Creating SSH key pair..." -ForegroundColor Cyan
        aws ec2 create-key-pair --key-name "$APP_NAME-key" --query 'KeyMaterial' --output text --region $REGION | Out-File -FilePath "$APP_NAME-key.pem" -Encoding ascii
        
        # Get default VPC
        $vpcId = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text --region $REGION
        
        # Create security group
        Write-Host "Creating security group..." -ForegroundColor Cyan
        $sgId = aws ec2 create-security-group --group-name "$APP_NAME-sg" --description "Security group for $APP_NAME" --vpc-id $vpcId --region $REGION --query "GroupId" --output text
        
        # Allow SSH and app port
        aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 22 --cidr 0.0.0.0/0 --region $REGION
        aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port $PORT --cidr 0.0.0.0/0 --region $REGION
        
        # User data script
        $userDataContent = "#!/bin/bash`nyum update -y`nyum install -y docker`nservice docker start`nusermod -a -G docker ec2-user`n`n# Pull and run container`ndocker pull $DOCKER_IMAGE`ndocker run -d -p ${PORT}:${PORT} --name $APP_NAME --restart unless-stopped $DOCKER_IMAGE"
        $userDataContent | Out-File -FilePath "user-data.sh" -Encoding utf8 -NoNewline
        
        # Get latest Amazon Linux 2 AMI
        Write-Host "Getting latest AMI..." -ForegroundColor Cyan
        $amiId = aws ec2 describe-images --owners amazon --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' --output text --region $REGION
        
        # Launch EC2 instance
        Write-Host "Launching EC2 instance..." -ForegroundColor Cyan
        $instanceId = aws ec2 run-instances `
            --image-id $amiId `
            --instance-type t3.micro `
            --key-name "$APP_NAME-key" `
            --security-group-ids $sgId `
            --user-data file://user-data.sh `
            --region $REGION `
            --query "Instances[0].InstanceId" `
            --output text
        
        Write-Host "✅ EC2 instance launching: $instanceId" -ForegroundColor Green
        Write-Host "Waiting for instance to start..." -ForegroundColor Cyan
        
        aws ec2 wait instance-running --instance-ids $instanceId --region $REGION
        
        $publicIp = aws ec2 describe-instances --instance-ids $instanceId --region $REGION --query "Reservations[0].Instances[0].PublicIpAddress" --output text
        
        Write-Host "`n🌐 Your backend is deployed at: http://${publicIp}:$PORT" -ForegroundColor Green
        Write-Host "🔑 SSH access: ssh -i $APP_NAME-key.pem ec2-user@$publicIp" -ForegroundColor Cyan
        Write-Host "`n✅ Copy the URL and update your frontend VITE_SOCKET_URL!" -ForegroundColor Yellow
    }
    
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n
✅ Deployment Complete!

Next steps:
1. Update frontend VITE_SOCKET_URL to point to your backend URL
2. Configure CORS in backend with FRONTEND_URL environment variable
3. Set up custom domain (optional)
4. Configure SSL/TLS certificate

To monitor your deployment:
- CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/
- AWS Console: https://console.aws.amazon.com/

To undeploy, run: .\aws-undeploy.ps1
" -ForegroundColor Green
