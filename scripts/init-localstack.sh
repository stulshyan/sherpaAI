#!/bin/bash
# Initialize LocalStack S3 buckets for local development

set -e

LOCALSTACK_ENDPOINT="${S3_ENDPOINT:-http://localhost:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "Waiting for LocalStack to be ready..."
until curl -s "${LOCALSTACK_ENDPOINT}/_localstack/health" | grep -q '"s3": "running"' 2>/dev/null; do
    echo "  LocalStack not ready yet, waiting..."
    sleep 2
done
echo "LocalStack is ready!"

# Create S3 buckets
BUCKETS=(
    "entropy-dev-uploads"
    "entropy-dev-artifacts"
    "entropy-dev-prompts"
    "entropy-dev-config"
)

for bucket in "${BUCKETS[@]}"; do
    echo "Creating bucket: $bucket"
    aws --endpoint-url="$LOCALSTACK_ENDPOINT" \
        --region "$AWS_REGION" \
        s3 mb "s3://$bucket" 2>/dev/null || echo "  Bucket $bucket already exists"
done

echo ""
echo "S3 buckets created successfully!"
echo ""
echo "Listing buckets:"
aws --endpoint-url="$LOCALSTACK_ENDPOINT" --region "$AWS_REGION" s3 ls

echo ""
echo "LocalStack S3 is ready for use at: $LOCALSTACK_ENDPOINT"
