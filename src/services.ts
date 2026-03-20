import http from 'http';

export function startService(port: number, version: string): http.Server {
  const server = http.createServer((req, res) => {
    const path = req.url?.split('?')[0] ?? '/';

    if (path === '/users' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version,
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      }));
      return;
    }

    if (path.startsWith('/users/') && req.method === 'GET') {
      const id = path.split('/')[2];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version, user: { id: Number(id), name: 'Alice' } }));
      return;
    }

    res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => console.log(`  ${version} service on :${port}`));
  return server;
}
