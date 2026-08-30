#!/bin/bash
set -e

echo "Starting Realistic Video Upscaler Serverless Worker..."
exec python3 -u /app/handler.py
