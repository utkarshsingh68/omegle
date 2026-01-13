# Deploy Coturn TURN Server on AWS EC2
# Provides dedicated TURN/STUN server for WebRTC video calls

$ErrorActionPreference = "Stop"

Write-Host "`n🎉 Deploying Coturn TURN Server on AWS EC2..." -ForegroundColor Green
Write-Host "Cost: ~$5/mo (t3.micro, free-tier eligible in many accounts)" -ForegroundColor Cyan
Write-Host "This will take about 5-7 minutes...`n" -ForegroundColor Cyan

$INSTANCE_NAME = "omegle-coturn"
$REGION = "us-east-1"
$KEY_NAME = "coturn-key"
$TURN_USER = "omegleuser"
$TURN_PASSWORD = "OmegleSecure$(Get-Random -Minimum 1000 -Maximum 9999)"
$REALM = "omegle.turn"

try {
    Write-Host "Step 1: Creating SSH key pair..." -ForegroundColor Cyan
    
    # Create key pair (skip if exists)
    try {
        aws ec2 create-key-pair `
            --key-name $KEY_NAME `
            --query 'KeyMaterial' `
            --output text `
            --region $REGION | Out-File -FilePath "$KEY_NAME.pem" -Encoding ascii
        Write-Host "Key pair created: $KEY_NAME.pem" -ForegroundColor Green
    } catch {
        Write-Host "Key pair already exists, using existing key" -ForegroundColor Yellow
    }
    
    Write-Host "`nStep 2: Creating security group..." -ForegroundColor Cyan
    
    # Get default VPC
    $vpcId = aws ec2 describe-vpcs `
        --filters "Name=isDefault,Values=true" `
        --query "Vpcs[0].VpcId" `
        --output text `
        --region $REGION
    
    # Create security group (idempotent)
    $sgId = $null
    try {
        $sgId = aws ec2 create-security-group `
            --group-name "$INSTANCE_NAME-sg" `
            --description "Security group for Coturn TURN server" `
            --vpc-id $vpcId `
            --region $REGION `
            --query "GroupId" `
            --output text
        if ($LASTEXITCODE -eq 0 -and $sgId) {
            Write-Host "Security group created: $sgId" -ForegroundColor Green
        }
    } catch {
        # ignore and resolve below
    }
    if (-not $sgId -or $sgId -eq 'None') {
        $sgId = aws ec2 describe-security-groups `
            --filters "Name=group-name,Values=$INSTANCE_NAME-sg" "Name=vpc-id,Values=$vpcId" `
            --query "SecurityGroups[0].GroupId" `
            --output text `
            --region $REGION
        Write-Host "Security group exists, using: $sgId" -ForegroundColor Yellow
    }
    
    # Allow SSH (port 22) and TURN/STUN ports (idempotent)
    $ingressRules = @(
        @{ Proto = 'tcp'; Port = '22' },
        @{ Proto = 'tcp'; Port = '3478' },
        @{ Proto = 'udp'; Port = '3478' },
        @{ Proto = 'tcp'; Port = '5349' },
        @{ Proto = 'udp'; Port = '5349' },
        @{ Proto = 'tcp'; Port = '443' },
        @{ Proto = 'udp'; Port = '443' },
        @{ Proto = 'udp'; Port = '49152-65535' }
    )

    $prevEA = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    foreach ($rule in $ingressRules) {
        $cmd = "aws ec2 authorize-security-group-ingress --group-id $sgId --protocol $($rule.Proto) --port $($rule.Port) --cidr 0.0.0.0/0 --region $REGION"
        cmd /c "$cmd" *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Rule exists or already set: $($rule.Proto)/$($rule.Port)" -ForegroundColor Yellow
        }
    }
    $ErrorActionPreference = $prevEA
    
    Write-Host "Security rules configured" -ForegroundColor Green
    
    Write-Host "`nStep 3: Creating Coturn configuration script..." -ForegroundColor Cyan
    
    # Create user data script
    $userData = @"
#!/bin/bash
set -e
apt-get update -y
apt-get upgrade -y
apt-get install -y coturn
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
cat > /etc/turnserver.conf <<'EOFCONF'
listening-port=3478
alt-listening-port=443
tls-listening-port=5349
external-ip=PUBLICIP
relay-ip=PRIVATEIP
realm=$REALM
user=${TURN_USER}:${TURN_PASSWORD}
lt-cred-mech
min-port=49152
max-port=65535
verbose
fingerprint
no-multicast-peers
no-tls
no-dtls
EOFCONF
PUBLIC_IP=`$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
PRIVATE_IP=`$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
sed -i "s/PUBLICIP/`$PUBLIC_IP/" /etc/turnserver.conf
sed -i "s/PRIVATEIP/`$PRIVATE_IP/" /etc/turnserver.conf
systemctl restart coturn
systemctl enable coturn
"@
    
    $userData | Out-File -FilePath "coturn-user-data.sh" -Encoding utf8
    
    Write-Host "`nStep 4: Getting latest Ubuntu AMI..." -ForegroundColor Cyan
    
    $amiId = aws ec2 describe-images `
        --owners 099720109477 `
        --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" `
        --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' `
        --output text `
        --region $REGION
    
    Write-Host "Using AMI: $amiId" -ForegroundColor Green
    
    Write-Host "`nStep 5: Launching EC2 instance..." -ForegroundColor Cyan
    
    $instanceId = aws ec2 run-instances `
        --image-id $amiId `
        --instance-type t3.micro `
        --key-name $KEY_NAME `
        --security-group-ids $sgId `
        --user-data file://coturn-user-data.sh `
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" `
        --region $REGION `
        --query "Instances[0].InstanceId" `
        --output text
    
    Write-Host "Instance launching: $instanceId" -ForegroundColor Green
    Write-Host "`nStep 6: Waiting for instance to start..." -ForegroundColor Cyan
    
    aws ec2 wait instance-running --instance-ids $instanceId --region $REGION
    
    Write-Host "Instance is running!" -ForegroundColor Green
    
    $publicIp = aws ec2 describe-instances `
        --instance-ids $instanceId `
        --region $REGION `
        --query "Reservations[0].Instances[0].PublicIpAddress" `
        --output text
    
    Write-Host "`nStep 7: Waiting for Coturn setup (60 seconds)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 60
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "COTURN DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nTURN Server IP: $publicIp" -ForegroundColor Yellow
    Write-Host "TURN URL: turn:${publicIp}:3478" -ForegroundColor Cyan
    Write-Host "Username: $TURN_USER" -ForegroundColor Cyan
    Write-Host "Password: $TURN_PASSWORD" -ForegroundColor Cyan
    Write-Host "`nSSH Access: ssh -i $KEY_NAME.pem ubuntu@$publicIp" -ForegroundColor Cyan
    
    # Save configuration
        $config = @"
// .env values for frontend (Vite)
VITE_TURN_URL=turn:${publicIp}:3478
VITE_TURN_USER=$TURN_USER
VITE_TURN_PASS=$TURN_PASSWORD

// Optional: add TCP on 443 if you front the instance with an A record
// VITE_TURN_URL=turn:${publicIp}:443
"@
    
    $config | Out-File -FilePath "coturn-config.txt" -Encoding utf8
    Write-Host "`nConfiguration saved to: coturn-config.txt`n" -ForegroundColor Cyan
    
    Remove-Item "coturn-user-data.sh" -ErrorAction SilentlyContinue -Force
    
} catch {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Remove-Item "coturn-user-data.sh" -ErrorAction SilentlyContinue -Force
}
