# Production Deployment

## Architecture Options

### 1. Embedded (Recommended for Most)
```typescript
// Runs in-process, sub-millisecond latency
import { AgentShield } from '@agentshield/sdk';

const shield = new AgentShield();
const result = shield.guard(request, policy);
```
- Zero network overhead
- No additional infrastructure
- Best for: microservices, serverless, edge

### 2. HTTP Gateway (Polyglot)
```bash
# Run as sidecar or separate service
docker run -d -p 8080:8080 agentshield/gateway
```
- Any language can call it
- Centralized policy management
- Best for: polyglot environments, legacy systems

### 3. gRPC Gateway (High-Performance)
```bash
docker run -d -p 50051:50051 agentshield/gateway-grpc
```
- 10x faster than REST
- Strong typing via protobuf
- Best for: high-throughput internal services

---

## Docker

### Embedded (No Docker needed — just `npm install`)

### Gateway
```dockerfile
# Dockerfile.gateway
FROM node:20-alpine
WORKDIR /app
COPY packages/gateway/package*.json ./
RUN npm ci --production
COPY packages/gateway/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

```bash
docker build -f Dockerfile.gateway -t agentshield/gateway .
docker run -d -p 8080:8080 \
  -e STRIPE_SECRET_KEY=sk_... \
  -e STRIPE_WEBHOOK_SECRET=whsec_... \
  agentshield/gateway
```

### gRPC
```dockerfile
# Dockerfile.grpc
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY packages/gateway-grpc/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o agentshield-grpc-server .

FROM alpine:3.19
COPY --from=builder /app/agentshield-grpc-server /usr/local/bin/
EXPOSE 50051
CMD ["agentshield-grpc-server"]
```

---

## Kubernetes

### Gateway Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentshield-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentshield-gateway
  template:
    metadata:
      labels:
        app: agentshield-gateway
    spec:
      containers:
      - name: gateway
        image: agentshield/gateway:latest
        ports:
        - containerPort: 8080
        env:
        - name: STRIPE_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: agentshield-secrets
              key: stripe-secret
        - name: STRIPE_WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: agentshield-secrets
              key: stripe-webhook
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: agentshield-gateway
spec:
  selector:
    app: agentshield-gateway
  ports:
  - port: 8080
    targetPort: 8080
```

### Horizontal Pod Autoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agentshield-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agentshield-gateway
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | For billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | For billing | Webhook signing secret |
| `STRIPE_PRICE_PRO` | For billing | Stripe Price ID for Pro |
| `STRIPE_PRICE_ENTERPRISE` | For billing | Stripe Price ID for Enterprise |
| `NEXT_PUBLIC_APP_URL` | Dashboard | Public URL for redirects |
| `AGENTSHIELD_API_KEY` | Dashboard auth | API key for control plane |
| `TELEMETRY_URL` | SDK | Where to send telemetry |
| `WEBHOOK_URL` | SDK | Where to send violation alerts |

---

## Monitoring

### Prometheus Metrics (Gateway)

```yaml
# Add to gateway for /metrics endpoint
import prometheus from 'prom-client';

// Exposes:
// agentshield_guard_total{status="allowed|blocked"}
// agentshield_guard_duration_seconds
// agentshield_policy_evaluation_duration_seconds
```

### Grafana Dashboard

Key panels:
- **Guard decisions/sec** (allowed vs blocked)
- **Latency p50/p95/p99**
- **Blocked by reason** (pie chart)
- **Circuit breaker trips**
- **Injection attacks detected**

---

## Security Checklist

- [ ] Store secrets in vault (not env vars)
- [ ] Enable TLS (terminate at ingress)
- [ ] Rate limit gateway ingress
- [ ] Audit log shipping to SIEM
- [ ] Regular policy review
- [ ] Circuit breaker alerting
- [ ] Budget cap alerting
- [ ] Injection attack alerting

---

## Disaster Recovery

### Policy Backup
```bash
# Export all policies
curl http://gateway:8080/v1/policies | jq -r '.policies[]' | xargs -I {} curl http://gateway:8080/v1/policies/{} > policies-backup.json

# Restore
cat policies-backup.json | jq -c '.[]' | while read policy; do
  id=$(echo $policy | jq -r '.id')
  curl -X POST http://gateway:8080/v1/policies -d "{\"id\":\"$id\",\"policy\":$policy}"
done
```

### Circuit Breaker Reset
```bash
# Via API (if implemented)
curl -X POST http://gateway:8080/v1/admin/circuit-breaker/reset -d '{"sessionKey":"agent-123"}'

# Or restart gateway pods
kubectl rollout restart deployment/agentshield-gateway
```

---

## Performance Tuning

| Setting | Default | High-Throughput |
|---------|---------|-----------------|
| Gateway replicas | 3 | 10+ |
| Gateway CPU limit | 500m | 2000m |
| Gateway memory | 256Mi | 1Gi |
| Node.js `--max-old-space-size` | 512 | 2048 |
| Go `GOMAXPROCS` | auto | 8 |

---

## Zero-Downtime Deployments

```yaml
# Rolling update strategy
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

Policy updates are instant (in-memory). Gateway reloads on SIGHUP or pod restart.