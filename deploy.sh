#!/bin/bash

set -e   # Exit immediately if any command fails

NAMESPACE="node-app"
K8S_DIR="k8s"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Kubernetes Deployment...${NC}"

# Check kubectl
if ! command -v kubectl &> /dev/null; then
  echo -e "${RED}❌ kubectl not found. Please install kubectl.${NC}"
  exit 1
fi

# Check cluster connection
echo "🔍 Checking Kubernetes cluster connection..."
kubectl cluster-info > /dev/null
echo -e "${GREEN}✅ Cluster reachable${NC}"

# Create namespace if not exists
if kubectl get namespace "$NAMESPACE" &> /dev/null; then
  echo -e "${GREEN}✅ Namespace '$NAMESPACE' already exists${NC}"
else
  echo "📦 Creating namespace '$NAMESPACE'..."
  kubectl create namespace "$NAMESPACE"
  echo -e "${GREEN}✅ Namespace created${NC}"
fi

# Apply ConfigMap
echo "⚙️  Applying ConfigMap..."
kubectl apply -f "$K8S_DIR/configmap.yaml"
echo -e "${GREEN}✅ ConfigMap applied${NC}"

# Apply Deployment
echo "📦 Applying Deployment..."
kubectl apply -f "$K8S_DIR/deployment.yaml"
echo -e "${GREEN}✅ Deployment applied${NC}"

# Apply Service
echo "🌐 Applying Service..."
kubectl apply -f "$K8S_DIR/service.yaml"
echo -e "${GREEN}✅ Service applied${NC}"

# Apply Ingress
echo "🚪 Applying Ingress..."
kubectl apply -f "$K8S_DIR/ingress.yaml"
echo -e "${GREEN}✅ Ingress applied${NC}"

# Wait for pods
echo "⏳ Waiting for pods to be ready..."
kubectl wait --namespace "$NAMESPACE" \
  --for=condition=ready pod \
  --selector=app=node-app \
  --timeout=120s

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"

# Show resources
echo "📊 Current resources in namespace '$NAMESPACE':"
kubectl get all -n "$NAMESPACE"
