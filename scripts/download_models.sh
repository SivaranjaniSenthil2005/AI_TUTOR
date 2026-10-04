#!/usr/bin/env bash
# Script to download MediaPipe face_landmarker.task model for AI Tutor

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="$ROOT_DIR/frontend/public/models"
MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
MODEL_FILE="$TARGET_DIR/face_landmarker.task"

mkdir -p "$TARGET_DIR"

if [ -f "$MODEL_FILE" ]; then
  echo "MediaPipe face_landmarker.task already exists at $MODEL_FILE"
  exit 0
fi

echo "Downloading MediaPipe Face Landmarker model..."
if command -v curl >/dev/null 2>&1; then
  curl -L "$MODEL_URL" -o "$MODEL_FILE"
elif command -v wget >/dev/null 2>&1; then
  wget "$MODEL_URL" -O "$MODEL_FILE"
else
  echo "Error: Neither curl nor wget was found. Please download $MODEL_URL manually to $MODEL_FILE"
  exit 1
fi

echo "Successfully downloaded face_landmarker.task to $MODEL_FILE"
