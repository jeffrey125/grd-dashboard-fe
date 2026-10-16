import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);

async function availablePort() {
  const server = net.createServer();

  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });

  const address = server.address();

  assert(address && typeof address === 'object');
  const { port } = address;

  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });

  return port;
}

function request(port: number, path: string, secure = true) {
  return new Promise<{ body: string; headers: http.IncomingHttpHeaders; status: number }>(
    (resolveRequest, reject) => {
      const transport = secure ? https : http;
      const call = transport.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method: 'GET',
          headers: { Host: '127.0.0.1' },
          rejectUnauthorized: false,
        },
        (response) => {
          let body = '';

          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () => {
            resolveRequest({
              body,
              headers: response.headers,
              status: response.statusCode ?? 0,
            });
          });
        },
      );

      call.setTimeout(5_000, () => call.destroy(new Error('Request timed out.')));
      call.on('error', reject);
      call.end();
    },
  );
}

// Opt-in release check. Its unique project owns only disposable containers,
// volumes and images and never starts the worker or contacts a Carrier.
test('LAN image and Compose lifecycle', { timeout: 900_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'grd-fe-container-'));
  const project = `grd-fe-check-${randomUUID().slice(0, 8)}`;
  const release = `test-${randomUUID().slice(0, 8)}`;
  const backendImage = `grd-dashboard-be:${release}`;
  const frontendImage = `grd-dashboard-fe:${release}`;
  const envFile = join(directory, 'lan.env');
  const httpPort = await availablePort();
  const httpsPort = await availablePort();
  const origin = `https://127.0.0.1:${httpsPort}`;

  await writeFile(
    envFile,
    [
      `GRD_RELEASE='${release}'`,
      `GRD_BACKEND_IMAGE='${backendImage}'`,
      `GRD_FRONTEND_IMAGE='${frontendImage}'`,
      "GRD_LAN_IP='127.0.0.1'",
      `GRD_ORIGIN='${origin}'`,
      `GRD_HTTP_PORT='${httpPort}'`,
      `GRD_HTTPS_PORT='${httpsPort}'`,
      "GRD_DB_NAME='grd_container_test'",
      "GRD_DB_USER='grd_container_test'",
      "GRD_DB_PASSWORD='disposable-database-password'",
      `GRD_AUTH_SECRET='${'disposable-auth-secret-'.repeat(3)}'`,
      "LOG_LEVEL='silent'",
      "UPS_ENVIRONMENT='cie'",
      "UPS_CLIENT_ID=''",
      "UPS_CLIENT_SECRET=''",
      "ECHOSHIP_URL='https://echoship.com/login'",
      "ECHOSHIP_USERNAME=''",
      "ECHOSHIP_PASSWORD=''",
      "FFE_URL='https://www.ffeinc.com/Customer/ShipmentTracking'",
      "FFE_USERNAME=''",
      "FFE_PASSWORD=''",
      "NTFY_URL=''",
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  const environment = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DOCKER_HOST: process.env.DOCKER_HOST,
    DOCKER_CONTEXT: process.env.DOCKER_CONTEXT,
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
  };
  const compose = (...args: string[]) =>
    execute(
      'docker',
      [
        'compose',
        '--project-name',
        project,
        '--env-file',
        envFile,
        '-f',
        resolve('docker-compose.lan.yml'),
        ...args,
      ],
      { env: environment, timeout: 600_000, maxBuffer: 16 * 1024 * 1024 },
    );

  try {
    await t.test('builds both application images from allowlisted contexts', async () => {
      await execute('docker', ['pull', 'postgres:18.3-alpine'], {
        env: environment,
        timeout: 300_000,
      });
      await execute('docker', ['build', '--tag', backendImage, resolve('../grd-dashboard-be')], {
        env: environment,
        timeout: 600_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      await execute(
        'docker',
        ['build', '--build-arg', `VITE_API_ORIGIN=${origin}`, '--tag', frontendImage, '.'],
        { env: environment, timeout: 600_000, maxBuffer: 16 * 1024 * 1024 },
      );
    });

    await t.test('migrates a fresh database and serves same-origin HTTPS', async () => {
      await compose('up', '--wait', '--wait-timeout', '120', 'frontend');

      const health = await request(httpsPort, '/healthz');
      const apiHealth = await request(httpsPort, '/api/v1/health/ready');
      const protectedApi = await request(httpsPort, '/api/v1/shipments');
      const deepLink = await request(httpsPort, '/shipments/example');
      const redirect = await request(httpPort, '/', false);

      assert.equal(health.status, 200);
      assert.equal(health.body, 'ok');
      assert.equal(apiHealth.status, 200);
      assert.equal(protectedApi.status, 401);
      assert.equal(deepLink.status, 200);
      assert.match(deepLink.body, /<div id="root"><\/div>/);
      assert.equal(redirect.status, 308);
      assert.match(redirect.headers.location ?? '', /^https:\/\//);

      const migrationCount = (
        await compose(
          'exec',
          '-T',
          'db',
          'psql',
          '-U',
          'grd_container_test',
          '-d',
          'grd_container_test',
          '-Atc',
          'SELECT count(*) FROM migrations',
        )
      ).stdout.trim();
      const carrierCount = (
        await compose(
          'exec',
          '-T',
          'db',
          'psql',
          '-U',
          'grd_container_test',
          '-d',
          'grd_container_test',
          '-Atc',
          'SELECT count(*) FROM carriers',
        )
      ).stdout.trim();

      assert.equal(migrationCount, '7');
      assert.equal(carrierCount, '3');
      assert.equal((await compose('ps', '-q', 'worker')).stdout.trim(), '');
      await compose(
        'exec',
        '-T',
        'frontend',
        'test',
        '-s',
        '/data/caddy/pki/authorities/local/root.crt',
      );

      const apiContainer = (await compose('ps', '-q', 'api')).stdout.trim();
      const portBindings = JSON.parse(
        (
          await execute(
            'docker',
            ['inspect', '--format', '{{json .HostConfig.PortBindings}}', apiContainer],
            { env: environment },
          )
        ).stdout,
      ) as Record<string, unknown>;

      assert.equal(portBindings['3000/tcp'], undefined);
    });

    await t.test('ships no source, test fixtures, secrets or backend runtime', async () => {
      await execute(
        'docker',
        [
          'run',
          '--rm',
          '--entrypoint',
          '/bin/sh',
          frontendImage,
          '-eu',
          '-c',
          [
            'test ! -e /srv/src',
            'test ! -e /srv/test',
            'test ! -e /srv/e2e',
            'test ! -e /srv/node_modules',
            'test ! -e /srv/.env',
            'test ! -e /srv/package.json',
            "! grep -R -F 'disposable-auth-secret' /srv /etc/caddy",
            "! grep -R -F 'frontend-admin@example.test' /srv /etc/caddy",
          ].join('; '),
        ],
        { env: environment, timeout: 30_000 },
      );
    });
  } finally {
    await compose('--profile', 'worker', 'down', '--volumes', '--remove-orphans').catch(() => {});
    await execute('docker', ['image', 'rm', '--force', frontendImage, backendImage], {
      env: environment,
    }).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
