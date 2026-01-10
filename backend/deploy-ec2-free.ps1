# AWS EC2 Free Tier Deployment
# 100% FREE for 12 months with new AWS account!

$ErrorActionPreference = "Stop"

Write-Host "`n🎉 Deploying to AWS EC2 (FREE TIER)..." -ForegroundColor Green
Write-Host "💰 Cost: FREE for 12 months (t2.micro)" -ForegroundColor Cyan
Write-Host "This will take about 5-7 minutes...`n" -ForegroundColor Cyan

$INSTANCE_NAME = "omegle-backend"
$REGION = "us-east-1"
$DOCKER_IMAGE = "utkarsh2568/omegle-backend:v1.1"
$PORT = "3001"
$KEY_NAME = "omegle-key"

try {
    Write-Host "Step 1: Creating SSH key pair..." -ForegroundColor Cyan
    
    # Create key pair
    aws ec2 create-key-pair `
        --key-name $KEY_NAME `
        --query 'KeyMaterial' `
        --output text `
        --region $REGION | Out-File -FilePath "$KEY_NAME.pem" -Encoding ascii
    
    Write-Host "✅ Key pair created: $KEY_NAME.pem" -ForegroundColor Green
    
    Write-Host "`nStep 2: Creating security group..." -ForegroundColor Cyan
    
    # Get default VPC
    $vpcId = aws ec2 describe-vpcs `
        --filters "Name=isDefault,Values=true" `
        --query "Vpcs[0].VpcId" `
        --output text `
        --region $REGION
    
    # Create security group
    $sgId = aws ec2 create-security-group `
        --group-name "$INSTANCE_NAME-sg" `
        --description "Security group for $INSTANCE_NAME" `
        --vpc-id $vpcId `
        --region $REGION `
        --query "GroupId" `
        --output text
    
    Write-Host "✅ Security group created: $sgId" -ForegroundColor Green
    
    # Allow SSH (port 22)
    aws ec2 authorize-security-group-ingress `
        --group-id $sgId `
        --protocol tcp `
        --port 22 `
        --cidr 0.0.0.0/0 `
        --region $REGION
    
    # Allow app port (3001)
    aws ec2 authorize-security-group-ingress `
        --group-id $sgId `
        --protocol tcp `
        --port $PORT `
        --cidr 0.0.0.0/0 `
        --region $REGION
    
    Write-Host "✅ Security rules configured (SSH + Port $PORT)" -ForegroundColor Green
    
    Write-Host "`nStep 3: Creating user data script..." -ForegroundColor Cyan
    
    # Create user data script
    $userData = @"
#!/bin/bash
# Update system
yum update -y

# Install Docker
yum install -y docker

# Start Docker service
service docker start

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Enable Docker to start on boot
chkconfig docker on

# Pull and run the container
docker pull $DOCKER_IMAGE
docker run -d -p ${PORT}:${PORT} --name $INSTANCE_NAME --restart unless-stopped $DOCKER_IMAGE

# Log the status
echo "Docker container started" > /var/log/omegle-deployment.log
docker ps >> /var/log/omegle-deployment.log
"@
    
    $userData | Out-File -FilePath "user-data.sh" -Encoding utf8
    
    Write-Host "`nStep 4: Getting latest Amazon Linux 2 AMI..." -ForegroundColor Cyan
    
    # Get latest Amazon Linux 2 AMI
    $amiId = aws ec2 describe-images `
        --owners amazon `
        --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" `
        --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' `
        --output text `
        --region $REGION
    
    Write-Host "✅ Using AMI: $amiId" -ForegroundColor Green
    
    Write-Host "`nStep 5: Launching EC2 instance (t2.micro - FREE tier)..." -ForegroundColor Cyan
    
    # Launch EC2 instance
    $instanceId = aws ec2 run-instances `
        --image-id $amiId `
        --instance-type t2.micro `
        --key-name $KEY_NAME `
        --security-group-ids $sgId `
        --user-data file://user-data.sh `
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" `
        --region $REGION `
        --query "Instances[0].InstanceId" `
        --output text
    
    Write-Host "✅ Instance launching: $instanceId" -ForegroundColor Green
    Write-Host "`nStep 6: Waiting for instance to start (this takes ~60 seconds)..." -ForegroundColor Cyan
    
    # Wait for instance to be running
    aws ec2 wait instance-running --instance-ids $instanceId --region $REGION
    
    Write-Host "✅ Instance is running!" -ForegroundColor Green
    
    # Get public IP
    $publicIp = aws ec2 describe-instances `
        --instance-ids $instanceId `
        --region $REGION `
        --query "Reservations[0].Instances[0].PublicIpAddress" `
        --output text
    
    Write-Host "`nStep 7: Waiting for Docker setup (30 seconds)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 30
    
    Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║          ✅ DEPLOYMENT SUCCESSFUL!                         ║" -ForegroundColor Green
    Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "║  🌐 Backend URL: http://${publicIp}:$PORT" -ForegroundColor Yellow
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "║  💰 Cost: FREE for 12 months (t2.micro free tier)         ║" -ForegroundColor Green
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "║  🔑 SSH Access:                                            ║" -ForegroundColor Green
    Write-Host "║     ssh -i $KEY_NAME.pem ec2-user@$publicIp" -ForegroundColor Cyan
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "║  📝 Next steps:                                            ║" -ForegroundColor Green
    Write-Host "║  1. Copy the URL above                                     ║" -ForegroundColor Green
    Write-Host "║  2. Update frontend .env.production:                       ║" -ForegroundColor Green
    Write-Host "║     VITE_SOCKET_URL=http://${publicIp}:$PORT" -ForegroundColor Cyan
    Write-Host "║  3. Keep $KEY_NAME.pem safe (needed for SSH)        ║" -ForegroundColor Green
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    
    Write-Host "`n📊 Instance Details:" -ForegroundColor Cyan
    Write-Host "   Instance ID: $instanceId" -ForegroundColor White
    Write-Host "   Public IP: $publicIp" -ForegroundColor White
    Write-Host "   Region: $REGION" -ForegroundColor White
    Write-Host "   Type: t2.micro (FREE tier)" -ForegroundColor White
    
    Write-Host "`n🔗 EC2 Console: https://console.aws.amazon.com/ec2/home?region=$REGION#Instances:instanceId=$instanceId" -ForegroundColor Cyan
    
    Write-Host "`n💡 Useful Commands:" -ForegroundColor Yellow
    Write-Host "   Check logs: ssh -i $KEY_NAME.pem ec2-user@$publicIp 'docker logs $INSTANCE_NAME'" -ForegroundColor White
    Write-Host "   Restart: ssh -i $KEY_NAME.pem ec2-user@$publicIp 'docker restart $INSTANCE_NAME'" -ForegroundColor White
    Write-Host "   Stop instance: aws ec2 stop-instances --instance-ids $instanceId --region $REGION" -ForegroundColor White
    Write-Host "   Terminate: aws ec2 terminate-instances --instance-ids $instanceId --region $REGION" -ForegroundColor White
    
    # Clean up temp file
    Remove-Item "user-data.sh" -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    
    Write-Host "`n💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure AWS CLI is installed: winget install Amazon.AWSCLI" -ForegroundColor White
    Write-Host "2. Configure credentials: aws configure" -ForegroundColor White
    Write-Host "3. Check your AWS free tier eligibility at: https://console.aws.amazon.com/billing/home#/freetier" -ForegroundColor White
    
    # Clean up temp file
    Remove-Item "user-data.sh" -ErrorAction SilentlyContinue
}

Write-Host "`n⚠️  IMPORTANT: Keep your $KEY_NAME.pem file safe!" -ForegroundColor Yellow
Write-Host "   You need it to SSH into your server.`n" -ForegroundColor Yellow
