# PowerShell script to download MediaPipe face_landmarker.task model for AI Tutor

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$TargetDir = Join-Path $RootDir "frontend\public\models"
$ModelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
$ModelFile = Join-Path $TargetDir "face_landmarker.task"

if (-not (Test-Path -Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

if (Test-Path -Path $ModelFile) {
    Write-Host "MediaPipe face_landmarker.task already exists at $ModelFile"
    exit 0
}

Write-Host "Downloading MediaPipe Face Landmarker model from $ModelUrl..."
Invoke-WebRequest -Uri $ModelUrl -OutFile $ModelFile

Write-Host "Successfully downloaded face_landmarker.task to $ModelFile"
