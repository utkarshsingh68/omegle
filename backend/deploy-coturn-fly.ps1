# Deploy Coturn TURN Server on Fly.io
# Free tier available, no AWS permissions needed
# Requires: flyctl CLI (https://fly.io/docs/hands-on/install-flyctl/)

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Deploying Coturn TURN Server on Fly.io..." -ForegroundColor Green
Write-Host "Cost: Free tier available (256MB RAM, shared CPU)" -ForegroundColor Cyan
Write-Host "This will take about 3-5 minutes...`n" -ForegroundColor Cyan

$APP_NAME = "omegle-coturn-$(Get-Random -Minimum 1000 -Maximum 9999)"
$TURN_USER = "omegleuser"
$TURN_PASSWORD = "OmegleSecure$(Get-Random -Minimum 1000 -Maximum 9999)"
$REALM = "omegle.turn"

# Check if flyctl is installed
$flyctl = Get-Command flyctl -ErrorAction SilentlyContinue
if (-not $flyctl) {
    Write-Host "❌ flyctl not found. Installing..." -ForegroundColor Yellow
    Write-Host "Run: powershell -Command `"iwr https://fly.io/install.ps1 -useb | iex`"" -ForegroundColor Cyan
    Write-Host "Then run: flyctl auth login" -ForegroundColor Cyan
    Write-Host "Then re-run this script.`n" -ForegroundColor Cyan
    exit 1
}

try {
    # Check auth
    Write-Host "Step 1: Checking Fly.io authentication..." -ForegroundColor Cyan
    $authCheck = flyctl auth whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Please login first: flyctl auth login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Authenticated as: $authCheck" -ForegroundColor Green

    # Create Dockerfile for coturn
    Write-Host "`nStep 2: Creating Coturn Docker configuration..." -ForegroundColor Cyan
    
    $dockerDir = "coturn-fly-deploy"
    New-Item -ItemType Directory -Force -Path $dockerDir | Out-Null
    
    @"
FROM coturn/coturn:latest

# Copy config
COPY turnserver.conf /etc/turnserver.conf

# Expose ports
EXPOSE 3478/tcp 3478/udp 443/tcp 443/udp 5349/tcp 5349/udp
EXPOSE 49152-49252/udp

CMD ["turnserver", "-c", "/etc/turnserver.conf"]
"@ | Out-File -FilePath "$dockerDir/Dockerfile" -Encoding utf8

    @"
listening-port=3478
alt-listening-port=443
tls-listening-port=5349
realm=$REALM
user=${TURN_USER}:${TURN_PASSWORD}
lt-cred-mech
min-port=49152
max-port=49252
verbose
fingerprint
no-multicast-peers
no-tls
no-dtls
log-file=stdout
"@ | Out-File -FilePath "$dockerDir/turnserver.conf" -Encoding utf8

    # Create fly.toml
    @"
app = "$APP_NAME"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[[services]]
  internal_port = 3478
  protocol = "udp"
  [[services.ports]]
    port = 3478

[[services]]
  internal_port = 3478
  protocol = "tcp"
  [[services.ports]]
    port = 3478

[[services]]
  internal_port = 443
  protocol = "udp"
  [[services.ports]]
    port = 443

[[services]]
  internal_port = 443
  protocol = "tcp"
  [[services.ports]]
    port = 443

[vm]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
"@ | Out-File -FilePath "$dockerDir/fly.toml" -Encoding utf8

    Write-Host "Configuration created" -ForegroundColor Green

    # Launch app
    Write-Host "`nStep 3: Creating Fly.io app..." -ForegroundColor Cyan
    Push-Location $dockerDir
    
    flyctl apps create $APP_NAME --org personal 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "App may already exist, continuing..." -ForegroundColor Yellow
    }

    # Allocate IP
    Write-Host "`nStep 4: Allocating public IP..." -ForegroundColor Cyan
    flyctl ips allocate-v4 --shared 2>$null
    
    # Deploy
    Write-Host "`nStep 5: Deploying Coturn..." -ForegroundColor Cyan
    flyctl deploy --ha=false
    
    # Get IP
    $ipInfo = flyctl ips list --json | ConvertFrom-Json
    $publicIp = ($ipInfo | Where-Object { $_.Type -eq "v4" }).Address
    if (-not $publicIp) {
        $publicIp = "$APP_NAME.fly.dev"
    }

    Pop-Location

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "COTURN DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nTURN Server: $publicIp" -ForegroundColor Yellow
    Write-Host "App URL: https://$APP_NAME.fly.dev" -ForegroundColor Cyan
    Write-Host "TURN URL: turn:${publicIp}:3478" -ForegroundColor Cyan
    Write-Host "Username: $TURN_USER" -ForegroundColor Cyan
    Write-Host "Password: $TURN_PASSWORD" -ForegroundColor Cyan

    # Save config
    $config = @"
# Add these to frontend/.env
VITE_TURN_URL=turn:${publicIp}:3478
VITE_TURN_USER=$TURN_USER
VITE_TURN_PASS=$TURN_PASSWORD

# Alternative using hostname (more reliable)
# VITE_TURN_URL=turn:${APP_NAME}.fly.dev:3478
"@
    
    $config | Out-File -FilePath "../coturn-config.txt" -Encoding utf8
    Write-Host "`nConfiguration saved to: coturn-config.txt" -ForegroundColor Cyan
    
    # Cleanup
    Remove-Item -Recurse -Force $dockerDir -ErrorAction SilentlyContinue

} catch {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Pop-Location -ErrorAction SilentlyContinue
}
