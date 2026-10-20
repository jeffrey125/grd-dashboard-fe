// Local-only test harness. Reuses the sibling backend's installed tooling and real app.

import { randomBytes } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readinessQuoteAdapter, releaseReadinessQuote } from './quote-readiness-fixture.mjs';
import { seedShipmentDetailFixtures } from './shipment-detail-fixtures.mjs';
import { seedShipmentHistoryFixtures } from './shipment-history-fixtures.mjs';
import { seedShipmentListFixtures } from './shipment-list-fixtures.mjs';

const backend = resolve('../grd-dashboard-be');
const apiPort = Number(process.env.FE_TEST_API_PORT ?? 3000);
if (!Number.isInteger(apiPort) || apiPort < 1024 || apiPort > 65535)
  throw new Error('Invalid FE_TEST_API_PORT');
const containerFile = resolve('/tmp', `grd-fe-auth-${apiPort}.container`);
const requireBackend = createRequire(resolve(backend, 'package.json'));
const { PostgreSqlContainer } = requireBackend('@testcontainers/postgresql');
const { NestFactory } = requireBackend('@nestjs/core');
const backendModule = (path) => import(pathToFileURL(resolve(backend, 'dist', path)).href);
let container;
let app;
let quoteWorker;
let readinessWorker;
let defaultsWorker;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await quoteWorker?.onModuleDestroy();
    await readinessWorker?.onModuleDestroy();
    defaultsWorker?.onModuleDestroy();
    await app?.close();
  } finally {
    try {
      await container?.stop();
    } finally {
      await rm(containerFile, { force: true });
    }
  }
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void stop().then(() => process.exit());
  });

try {
  container = await new PostgreSqlContainer('postgres:18.3-alpine')
    .withLabels({ 'grd.fe.test.api-port': String(apiPort) })
    .withDatabase('fe_auth_test')
    .withUsername('fe_auth_test')
    .withPassword(randomBytes(24).toString('hex'))
    .start();
  await writeFile(containerFile, `${container.getId()}\n`, { mode: 0o600 });
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    PORT: String(apiPort),
    AUTH_SECRET: randomBytes(48).toString('hex'),
    AUTH_BASE_URL: `http://localhost:${apiPort}`,
    AUTH_TRUSTED_ORIGINS: 'http://localhost:4175,http://localhost:4176,http://localhost:5173',
    DB_HOST: container.getHost(),
    DB_PORT: String(container.getPort()),
    DB_NAME: container.getDatabase(),
    DB_USER: container.getUsername(),
    DB_PASSWORD: container.getPassword(),
    DB_SSL_MODE: 'disable',
  });
  const { default: source } = await backendModule('infrastructure/database/data-source.js');
  await source.initialize();
  try {
    await source.runMigrations();
  } finally {
    await source.destroy();
  }
  const { AppModule } = await backendModule('app.module.js');
  const { configureApiRoutes } = await backendModule('runtime/api-routing.js');
  const { AuthService } = await backendModule('modules/auth/auth.service.js');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApiRoutes(app);
  if (process.env.FE_TEST_QUOTE_READINESS === 'true') {
    // Test-only release control exists solely in this disposable harness.
    app
      .getHttpAdapter()
      .getInstance()
      .post('/__test/quote-release/:key', (request, response) => {
        response.sendStatus(releaseReadinessQuote(request.params.key) ? 204 : 404);
      });
  }
  await app.init();
  const auth = app.get(AuthService);
  const email = 'frontend-admin@example.test';
  await auth.bootstrap({
    firstName: 'Frontend',
    lastName: 'Admin',
    email,
    password: 'issued fixture password',
    role: 'admin',
  });
  const principalFor = async (email, password) => {
    const result = await auth.signIn({ email, password });
    return auth.authenticate(
      new Headers({ cookie: result.cookies.map((value) => value.split(';')[0]).join('; ') }),
    );
  };
  await auth.changePassword(await principalFor(email, 'issued fixture password'), {
    currentPassword: 'issued fixture password',
    newPassword: 'admin fixture password',
  });
  const admin = await principalFor(email, 'admin fixture password');
  const fixtures = [
    { name: 'staff', password: 'staff fixture password', role: 'staff' },
    { name: 'restricted', password: null, role: 'staff' },
    { name: 'shipments', password: 'shipments fixture password', role: 'staff' },
    { name: 'details', password: 'details fixture password', role: 'staff' },
    { name: 'history', password: 'history fixture password', role: 'staff' },
    {
      name: 'accounts-primary-admin',
      lastName: 'Admin',
      password: 'admin fixture password',
      role: 'admin',
    },
    {
      name: 'accounts-self-admin',
      lastName: 'Admin',
      password: 'admin fixture password',
      role: 'admin',
    },
    ...['4175', '4176'].flatMap((port) => [
      { name: `carriers-${port}-admin`, password: 'admin fixture password', role: 'admin' },
      { name: `carriers-${port}-staff`, password: 'staff fixture password', role: 'staff' },
      { name: `create-${port}-admin`, password: 'admin fixture password', role: 'admin' },
      { name: `create-${port}-staff`, password: 'shipments fixture password', role: 'staff' },
      { name: `details-${port}-admin`, password: 'admin fixture password', role: 'admin' },
      { name: `live-${port}-staff`, password: 'staff fixture password', role: 'staff' },
      { name: `overview-${port}-staff`, password: 'staff fixture password', role: 'staff' },
      { name: `tracking-${port}-staff`, password: 'shipments fixture password', role: 'staff' },
    ]),
  ];

  for (const fixture of fixtures) {
    const accountEmail = `frontend-${fixture.name}@example.test`;
    await auth.createAccount(admin, {
      firstName: 'Frontend',
      lastName: fixture.lastName ?? fixture.name,
      email: accountEmail,
      password: 'issued fixture password',
      role: fixture.role,
    });
    if (fixture.password)
      await auth.changePassword(await principalFor(accountEmail, 'issued fixture password'), {
        currentPassword: 'issued fixture password',
        newPassword: fixture.password,
      });
  }
  const { DataSource } = requireBackend('typeorm');
  await seedShipmentListFixtures(app.get(DataSource));
  await seedShipmentDetailFixtures(app.get(DataSource));
  const { TrackingService } = await backendModule('modules/tracking/tracking.service.js');
  const { TypeOrmTrackingRepository } = await backendModule(
    'modules/tracking/typeorm-tracking.repository.js',
  );
  await seedShipmentHistoryFixtures(
    app.get(DataSource),
    new TrackingService(new TypeOrmTrackingRepository(app.get(DataSource))),
  );
  if (process.env.FE_TEST_QUOTE_READINESS === 'true') {
    await app
      .get(DataSource)
      .query("UPDATE shipping_providers SET execution_mode='browser' WHERE code='unishippers'");
  }
  if (process.env.FE_TEST_QUOTE_DEMO === 'true' || process.env.FE_TEST_QUOTE_READINESS === 'true') {
    const { QuoteWorker } = await backendModule('modules/shipping-quotes/quote.worker.js');
    const { TypeOrmQuoteExecutionRepository } = await backendModule(
      'modules/shipping-quotes/typeorm-quote-execution.repository.js',
    );
    const { FixtureQuoteAdapter } = await backendModule(
      'modules/shipping-quotes/fixture-quote.adapter.js',
    );
    const { ProjectLogger } = await backendModule('infrastructure/logging/logging.types.js');
    quoteWorker = new QuoteWorker(
      new TypeOrmQuoteExecutionRepository(app.get(DataSource)),
      (code) =>
        process.env.FE_TEST_QUOTE_READINESS === 'true'
          ? readinessQuoteAdapter(code)
          : new FixtureQuoteAdapter(
              code === 'amazon'
                ? 'success'
                : process.env.FE_TEST_QUOTE_RETRY === 'true'
                  ? 'failed'
                  : 'validation_failed',
            ),
      app.get(ProjectLogger),
    );
    quoteWorker.onModuleInit();
  }
  if (process.env.FE_TEST_PROVIDER_ADMIN === 'true') {
    const { ProviderReadinessWorker } = await backendModule(
      'modules/shipping-quotes/provider-readiness.worker.js',
    );
    const { TypeOrmProviderAdminRepository } = await backendModule(
      'modules/shipping-quotes/typeorm-provider-admin.repository.js',
    );
    const { SenderDefaultsWorker } = await backendModule(
      'modules/shipping-quotes/sender-defaults.worker.js',
    );
    const { TypeOrmSenderDefaultsRepository } = await backendModule(
      'modules/shipping-quotes/typeorm-sender-defaults.repository.js',
    );
    // Explicit fixture workers: never load credentials or contact real providers.
    readinessWorker = new ProviderReadinessWorker(
      new TypeOrmProviderAdminRepository(app.get(DataSource)),
      () => ({
        readiness: async () => {
          throw new Error('Fixture readiness failure');
        },
        close: async () => {},
      }),
    );
    defaultsWorker = new SenderDefaultsWorker(
      new TypeOrmSenderDefaultsRepository(app.get(DataSource)),
      {
        read: async () => ({
          name: 'Fixture warehouse',
          street: '1 Example Street',
          city: 'Walworth',
          division: 'WI',
          postalCode: '53125',
          country: 'US',
        }),
      },
    );
    readinessWorker.onModuleInit();
    defaultsWorker.onModuleInit();
  }
  await app.listen(apiPort, 'localhost');
  console.log(
    `Isolated auth API ready at http://localhost:${apiPort}/api/v1 (tracking worker disabled; quote demo ${quoteWorker ? 'enabled' : 'disabled'}).`,
  );
} catch (error) {
  console.error(
    'Isolated auth API failed. Check Docker access, backend build, and test API port availability.',
  );
  // Codes aid fixture diagnosis without logging SQL parameters, cookies or credentials.
  console.error('Failure type:', error?.name ?? 'unknown', 'code:', error?.code ?? 'unavailable');
  await stop();
  process.exitCode = 1;
}
