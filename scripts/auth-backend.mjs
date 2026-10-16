// Local-only test harness. Reuses the sibling backend's installed tooling and real app.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const backend = resolve('../grd-dashboard-be');
const requireBackend = createRequire(resolve(backend, 'package.json'));
const { PostgreSqlContainer } = requireBackend('@testcontainers/postgresql');
const { NestFactory } = requireBackend('@nestjs/core');
const backendModule = (path) => import(pathToFileURL(resolve(backend, 'dist', path)).href);
let container;
let app;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await app?.close();
  } finally {
    await container?.stop();
  }
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void stop().then(() => process.exit());
  });

try {
  container = await new PostgreSqlContainer('postgres:18.3-alpine')
    .withDatabase('fe_auth_test')
    .withUsername('fe_auth_test')
    .withPassword(randomBytes(24).toString('hex'))
    .start();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    PORT: '3000',
    AUTH_SECRET: randomBytes(48).toString('hex'),
    AUTH_BASE_URL: 'http://localhost:3000',
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
  for (const name of ['staff', 'restricted']) {
    const accountEmail = `frontend-${name}@example.test`;
    await auth.createAccount(admin, {
      firstName: 'Frontend',
      lastName: name,
      email: accountEmail,
      password: 'issued fixture password',
      role: 'staff',
    });
    if (name === 'staff')
      await auth.changePassword(await principalFor(accountEmail, 'issued fixture password'), {
        currentPassword: 'issued fixture password',
        newPassword: 'staff fixture password',
      });
  }
  await app.listen(3000, 'localhost');
  console.log('Isolated auth API ready at http://localhost:3000/api/v1 (worker disabled).');
} catch {
  console.error(
    'Isolated auth API failed. Check Docker access, backend build, and port 3000 availability.',
  );
  await stop();
  process.exitCode = 1;
}
