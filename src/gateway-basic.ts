import http from 'http';
import {
  GatewayServer,
  GatewayFullConfig,
  ProxyRequest,
} from '@hazeljs/gateway';
import {
  MemoryRegistryBackend,
  ServiceStatus,
} from '@hazeljs/discovery';
import { startService } from './services';

async function main() {
  startService(3001, 'v1');
  startService(3002, 'v2');

  const backend = new MemoryRegistryBackend();

  await backend.register({
    id: 'user-v1-1',
    name: 'user-service',
    host: 'localhost',
    port: 3001,
    protocol: 'http',
    status: ServiceStatus.UP,
    metadata: { version: 'v1' },
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
  });

  await backend.register({
    id: 'user-v2-1',
    name: 'user-service',
    host: 'localhost',
    port: 3002,
    protocol: 'http',
    status: ServiceStatus.UP,
    metadata: { version: 'v2' },
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
  });

  const config: GatewayFullConfig = {
    discovery: { cacheEnabled: false },
    routes: [
      {
        path: '/api/users/**',
        serviceName: 'user-service',
        serviceConfig: {
          serviceName: 'user-service',
          stripPrefix: '/api/users',
          addPrefix: '/users',
        },
      },
    ],
  };

  const gateway = GatewayServer.fromConfig(config, backend);

  const server = http.createServer(async (req, res) => {
    const request: ProxyRequest = {
      method: req.method ?? 'GET',
      path: req.url?.split('?')[0] ?? '/',
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])
      ),
    };

    const response = await gateway.handleRequest(request);

    res.writeHead(response.status, response.headers as Record<string, string>);
    res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body));
  });

  server.listen(3000, () => {
    console.log('\nGateway on :3000');
    console.log('  GET http://localhost:3000/api/users/\n');
  });
}

main().catch(console.error);
