import http from 'http';
import {
  GatewayServer,
  GatewayFullConfig,
  ProxyRequest,
} from '@hazeljs/gateway';
import { MemoryRegistryBackend, ServiceStatus } from '@hazeljs/discovery';
import { startService } from './services';

async function main() {
  startService(3001, 'v1');
  startService(3002, 'v2');
  startService(3003, 'shadow');

  const backend = new MemoryRegistryBackend();

  await backend.register({
    id: 'user-v1-1', name: 'user-service', host: 'localhost', port: 3001,
    protocol: 'http', status: ServiceStatus.UP, metadata: { version: 'v1' },
    lastHeartbeat: new Date(), registeredAt: new Date(),
  });

  await backend.register({
    id: 'user-v2-1', name: 'user-service', host: 'localhost', port: 3002,
    protocol: 'http', status: ServiceStatus.UP, metadata: { version: 'v2' },
    lastHeartbeat: new Date(), registeredAt: new Date(),
  });

  await backend.register({
    id: 'shadow-1', name: 'user-service-shadow', host: 'localhost', port: 3003,
    protocol: 'http', status: ServiceStatus.UP, metadata: {},
    lastHeartbeat: new Date(), registeredAt: new Date(),
  });

  const config: GatewayFullConfig = {
    discovery: { cacheEnabled: false },
    resilience: {
      defaultTimeout: 5000,
    },
    routes: [
      {
        path: '/api/users/**',
        serviceName: 'user-service',
        serviceConfig: {
          serviceName: 'user-service',
          stripPrefix: '/api/users',
          addPrefix: '/users',
        },
        canary: {
          stable: { version: 'v1', weight: 90 },
          canary: { version: 'v2', weight: 10 },
          promotion: {
            strategy: 'error-rate',
            errorThreshold: 5,
            evaluationWindow: '30s',
            autoPromote: true,
            autoRollback: true,
            steps: [10, 25, 50, 75, 100],
            stepInterval: '1m',
            minRequests: 5,
          },
        },
        trafficPolicy: {
          mirror: {
            service: 'user-service-shadow',
            percentage: 100,
            waitForResponse: false,
          },
        },
        circuitBreaker: { failureThreshold: 5, resetTimeout: 30000 },
        rateLimit: { strategy: 'sliding-window' as const, max: 100, window: 60000 },
      },
    ],
  };

  const gateway = GatewayServer.fromConfig(config, backend);

  gateway.on('canary:promote' as any, (data: any) =>
    console.log(`[canary] promoted → step ${data.step}/${data.totalSteps}, weight: ${data.canaryWeight}%`));
  gateway.on('canary:rollback' as any, (data: any) =>
    console.log(`[canary] rolled back — trigger: ${data.trigger}`));
  gateway.on('canary:complete' as any, (data: any) =>
    console.log(`[canary] complete — ${data.version} is now stable`));

  gateway.startCanaries();

  const server = http.createServer(async (req, res) => {
    if (req.url === '/gateway/metrics' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(gateway.getMetrics().getSnapshot(), null, 2));
      return;
    }

    if (req.url === '/gateway/canary' && req.method === 'GET') {
      const engine = gateway.getCanaryEngine('/api/users/**');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(engine?.getStatus() ?? { error: 'No canary' }, null, 2));
      return;
    }

    const request: ProxyRequest = {
      method: req.method ?? 'GET',
      path: req.url?.split('?')[0] ?? '/',
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])
      ),
    };

    const response = await gateway.handleRequest(request);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(response.headers)) {
      if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    if (!headers['content-type']) headers['content-type'] = 'application/json';

    res.writeHead(response.status, headers);
    res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body));
  });

  server.listen(3000, () => {
    console.log('\nGateway on :3000');
    console.log('  GET  http://localhost:3000/api/users/');
    console.log('  GET  http://localhost:3000/api/users/1');
    console.log('  GET  http://localhost:3000/gateway/metrics');
    console.log('  GET  http://localhost:3000/gateway/canary\n');
  });
}

main().catch(console.error);
