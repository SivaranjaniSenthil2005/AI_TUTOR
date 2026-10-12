# scripts/dev_all.ps1 - Start AI Tutor Backend & Frontend together
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting AI Tutor (Standard 10 RAG & Gaze)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# Check environment first
Write-Host "[1/3] Checking environment..." -ForegroundColor Yellow
python "$rootDir/scripts/check_env.py"

# Start Backend Process
Write-Host "[2/3] Starting Backend (FastAPI on 127.0.0.1:8000)..." -ForegroundColor Yellow
$backendPython = "$rootDir/backend/.venv/Scripts/python.exe"
if (-not (Test-Path $backendPython)) {
    $backendPython = "python"
}

$backendJob = Start-Process -FilePath $backendPython -ArgumentList "-m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" -WorkingDirectory "$rootDir/backend" -PassThru

# Start Frontend Process
Write-Host "[3/3] Starting Frontend (Next.js on 127.0.0.1:3000)..." -ForegroundColor Green
try {
    Set-Location -Path "$rootDir/frontend"
    npm run dev
} finally {
    Write-Host "Stopping backend process ($($backendJob.Id))..." -ForegroundColor Red
    if ($backendJob -and -not $backendJob.HasExited) {
        Stop-Process -Id $backendJob.Id -Force
    }
}
