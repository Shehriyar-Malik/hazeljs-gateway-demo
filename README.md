# @hazeljs/gateway Demo

Version routing, canary deployments, and traffic mirroring — without Kubernetes, Istio, or YAML.

## What's in here

| File | Description |
|---|---|
| `src/services.ts` | Minimal HTTP backend services that return their version |
| `src/gateway-basic.ts` | Basic gateway with service discovery and round-robin routing |
| `src/gateway-versioned.ts` | Version routing via header, URI, or weighted strategies |
| `src/main.ts` | Full example — canary deployments, traffic mirroring, metrics |

## Setup

```bash
npm install
```

## Run

```bash
# Basic gateway with service discovery
npx ts-node src/gateway-basic.ts

# Version routing (header / weighted)
npx ts-node src/gateway-versioned.ts

# Full example — canary + mirroring + metrics
npx ts-node src/main.ts
```

## Test

```bash
# Basic request (routed via canary: 90% v1, 10% v2)
curl http://localhost:3000/api/users/

# Explicit version via header
curl -H "X-API-Version: v2" http://localhost:3000/api/users/

# Canary status
curl http://localhost:3000/gateway/canary

# Metrics
curl http://localhost:3000/gateway/metrics
```

## Architecture

```
Client Request
      │
      ▼
┌─────────────────────┐
│  Gateway Server      │  :3000
│  ┌────────────────┐  │
│  │ Route Matcher   │  │  ← /api/users/** → user-service
│  │ Version Router  │  │  ← X-API-Version: v2
│  │ Canary Engine   │  │  ← 90/10 → auto-promote or rollback
│  │ Traffic Mirror  │  │  ← fire-and-forget to shadow
│  │ Service Proxy   │  │  ← discovery + circuit breaker + retry
│  └────────────────┘  │
└──────────┬───────────┘
           │
     ┌─────┼──────┐
     ▼     ▼      ▼
  :3001  :3002  :3003
  user   user   shadow
  v1     v2     service
```

## Links

- [@hazeljs/gateway on npm](https://www.npmjs.com/package/@hazeljs/gateway)
- [@hazeljs/discovery on npm](https://www.npmjs.com/package/@hazeljs/discovery)
- [@hazeljs/resilience on npm](https://www.npmjs.com/package/@hazeljs/resilience)
- [HazelJS GitHub](https://github.com/hazel-js/hazeljs)
- [HazelJS Documentation](https://hazeljs.ai)
