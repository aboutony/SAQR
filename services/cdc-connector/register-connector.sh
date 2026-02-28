#!/bin/bash
# ============================================
# SAQR — Register Debezium CDC Connector
# Run this after docker-compose is healthy
# ============================================

set -e

CONNECT_URL="http://localhost:8083"

echo "🦅 SAQR — Waiting for Kafka Connect to be ready..."
until curl -s "$CONNECT_URL/connectors" > /dev/null 2>&1; do
    sleep 2
done

echo "🦅 SAQR — Registering CDC connector..."
curl -X POST "$CONNECT_URL/connectors" \
  -H "Content-Type: application/json" \
  -d @connector-config.json

echo ""
echo "✅ Connector registered. Checking status..."
sleep 3
curl -s "$CONNECT_URL/connectors/saqr-source-connector/status" | python3 -m json.tool

echo ""
echo "🦅 SAQR CDC Pipeline is LIVE. Golden Rule: READ-ONLY."
