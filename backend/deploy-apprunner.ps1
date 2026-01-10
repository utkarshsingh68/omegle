# Quick AWS Lightsail Deployment
# Cheaper than App Runner - 3 months free trial, then $7/month

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Deploying to AWS Lightsail..." -ForegroundColor Green
Write-Host "💰 Cost: FREE for 3 months, then $7/month" -ForegroundColor Cyan
Write-Host "This will take about 3-5 minutes...`n" -ForegroundColor Cyan

$SERVICE_NAME = "omegle-backend"
$REGION = "us-east-1"
$DOCKER_IMAGE = "utkarsh2568/omegle-backend:v1.1"
$PORT = "3001"

try {
    Write-Host "Step 1: Creating Lightsail container service..." -ForegroundColor Cyan
    
    # Create Lightsail container service (nano = free tier for 3 months)
    aws lightsail create-container-service `
        --service-name $SERVICE_NAME `
        --power nano `
        --scale 1 `
        --region $REGION
    
    Write-Host "✅ Container service created!" -ForegroundColor Green
    Write-Host "`nStep 2: Waiting for service to be active..." -ForegroundColor Cyan
    Start-Sleep -Seconds 30
    
    # Create deployment configuration file
    $deploymentConfig = @{
        containers = @{
            app = @{
                image = $DOCKER_IMAGE
                ports = @{
                    $PORT = "HTTP"
                }
                environment = @{
                    NODE_ENV = "production"
                    PORT = $PORT
                }
            }
        }
        publicEndpoint = @{
            containerName = "app"
            containerPort = [int]$PORT
            healthCheck = @{
                path = "/"
                intervalSeconds = 30
            }
        }
    } | ConvertTo-Json -Depth 10
    
    $deploymentConfig | Out-File -FilePath "lightsail-deployment.json" -Encoding utf8
    
    Write-Host "Step 3: Deploying container..." -ForegroundColor Cyan
    
    # Deploy the container
    aws lightsail create-container-service-deployment `
        --service-name $SERVICE_NAME `
        --cli-input-json file://lightsail-deployment.json `
        --region $REGION
    
    Write-Host "`n✅ Deployment initiated!" -ForegroundColor Green
    Write-Host "Waiting for deployment to complete (this may take 3-5 minutes)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 60
    
    # Get the service URL
    $serviceInfo = aws lightsail get-container-services --service-name $SERVICE_NAME --region $REGION | ConvertFrom-Json
    $serviceUrl = $serviceInfo.containerServices[0].url
    
    if ($serviceUrl) {
        Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Green
        Write-Host "║          ✅ DEPLOYMENT SUCCESSFUL!                 ║" -ForegroundColor Green
        Write-Host "╠════════════════════════════════════════════════════╣" -ForegroundColor Green
        Write-Host "║                                                    ║" -ForegroundColor Green
        Write-Host "║  🌐 Backend URL: https://$serviceUrl" -ForegroundColor Yellow
        Write-Host "║                                                    ║" -ForegroundColor Green
        Write-Host "║  💰 Cost: FREE for 3 months, then `$7/month        ║" -ForegroundColor Green
        Write-Host "║                                                    ║" -ForegroundColor Green
        Write-Host "║  📝 Next steps:                                    ║" -ForegroundColor Green
        Write-Host "║  1. Copy the URL above                             ║" -ForegroundColor Green
        Write-Host "║  2. Update frontend .env.production:               ║" -ForegroundColor Green
        Write-Host "║     VITE_SOCKET_URL=https://$serviceUrl            ║" -ForegroundColor Cyan
        Write-Host "║                                                    ║" -ForegroundColor Green
        Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
        
        Write-Host "`n🔗 Lightsail Console: https://lightsail.aws.amazon.com/ls/webapp/$REGION/container-services/$SERVICE_NAME" -ForegroundColor Cyan
    }
    
    # Clean up temp file
    Remove-Item "lightsail-deployment.json" -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    
    if ($_.Exception.Message -like "*AlreadyExistsException*") {
        Write-Host "`n💡 Service already exists. To redeploy:" -ForegroundColor Yellow
        Write-Host "1. Delete existing service:" -ForegroundColor Yellow
        Write-Host "   aws lightsail delete-container-service --service-name $SERVICE_NAME --region $REGION" -ForegroundColor Cyan
        Write-Host "2. Or use Lightsail Console: https://lightsail.aws.amazon.com/" -ForegroundColor Cyan
    }
    
    # Clean up temp file
    Remove-Item "lightsail-deployment.json" -ErrorAction SilentlyContinue
}
