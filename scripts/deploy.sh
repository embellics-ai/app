#!/bin/bash

# Deployment script for Render
# This runs after build and before starting the server

set -e  # Exit on error

echo "🚀 Starting deployment process..."

# Run database migrations
echo "📦 Running database migrations..."
npm run db:migrate

echo "✅ Deployment completed successfully!"
