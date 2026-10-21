import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
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

function request(port: number, path: string) {
  return new Promise<{ body: string; status: number }>((resolveRequest, reject) => {
    const call = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers: { Host: '127.0.0.1' },
      },
      (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolveRequest({ body, status: response.statusCode ?? 0 });
        });
      },
    );

    call.setTimeout(5_000, () => call.destroy(new Error('Request timed out.')));
    call.on('error', reject);
    call.end();
  });
}

test('HTTP-only LAN override is explicit and functional', { timeout: 900_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'grd-fe-http-container-'));
  const project = `grd-fe-http-${randomUUID().slice(0, 8)}`;
  const release = `test-http-${randomUUID().slice(0, 8)}`;
  const backendImage = `grd-dashboard-be:${release}`;
  const frontendImage = `grd-dashboard-fe:${release}`;
  const envFile = join(directory, 'lan-http.env');
  const httpPort = await availablePort();
  const origin = `http://127.0.0.1:${httpPort}`;

  await writeFile(
    envFile,
    [
      `GRD_RELEASE='${release}'`,
      `GRD_BACKEND_IMAGE='${backendImage}'`,
      `GRD_FRONTEND_IMAGE='${frontendImage}'`,
      "GRD_LAN_IP='127.0.0.1'",
      `GRD_HTTP_PORT='${httpPort}'`,
      `GRD_ORIGIN='${origin}'`,
      "GRD_HTTP_ONLY='true'",
      "GRD_DB_NAME='grd_http_container_test'",
      "GRD_DB_USER='grd_http_container_test'",
      "GRD_DB_PASSWORD='disposable-database-password'",
      `GRD_AUTH_SECRET='${'disposable-auth-secret-'.repeat(3)}'`,
      "LOG_LEVEL='silent'",
      "UPS_ENVIRONMENT='cie'",
      "UPS_CLIENT_ID=''",
      "UPS_CLIENT_SECRET=''",
      "AMAZON_SP_API_SANDBOX_CLIENT_ID=''",
      "AMAZON_SP_API_SANDBOX_CLIENT_SECRET=''",
      "AMAZON_SP_API_SANDBOX_REFRESH_TOKEN=''",
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
        '-f',
        resolve('docker-compose.lan-http.yml'),
        ...args,
      ],
      { env: environment, timeout: 600_000, maxBuffer: 16 * 1024 * 1024 },
    );

  try {
    await t.test('builds the HTTP frontend image with the HTTP Caddyfile', async () => {
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
        [
          'build',
          '--build-arg',
          `VITE_API_ORIGIN=${origin}`,
          '--build-arg',
          'CADDYFILE=Caddyfile.http',
          '--tag',
          frontendImage,
          '.',
        ],
        { env: environment, timeout: 600_000, maxBuffer: 16 * 1024 * 1024 },
      );
    });

    await t.test('serves HTTP without publishing HTTPS or running the worker', async () => {
      await compose('up', '--wait', '--wait-timeout', '120', 'frontend');

      const health = await request(httpPort, '/healthz');
      const apiHealth = await request(httpPort, '/api/v1/health/ready');
      const protectedApi = await request(httpPort, '/api/v1/shipments');
      const deepLink = await request(httpPort, '/shipments/example');

      assert.deepEqual(health, { body: 'ok', status: 200 });
      assert.equal(apiHealth.status, 200);
      assert.equal(protectedApi.status, 401);
      assert.equal(deepLink.status, 200);
      assert.match(deepLink.body, /<div id="root"><\/div>/);

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
      assert.ok(portBindings['80/tcp']);
      assert.equal(portBindings['443/tcp'], undefined);
      assert.equal(portBindings['443/udp'], undefined);

      const apiEnvironment = JSON.parse(
        (
          await execute('docker', ['inspect', '--format', '{{json .Config.Env}}', apiContainer], {
            env: environment,
          })
        ).stdout,
      ) as string[];
      assert.ok(apiEnvironment.includes('NODE_ENV=development'));
      assert.equal((await compose('ps', '-q', 'worker')).stdout.trim(), '');
    });
  } finally {
    await compose('--profile', 'worker', 'down', '--volumes', '--remove-orphans').catch(() => {});
    await execute('docker', ['image', 'rm', '--force', frontendImage, backendImage], {
      env: environment,
    }).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
