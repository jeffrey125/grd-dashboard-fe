import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';

const { values } = parseArgs({
  options: {
    ip: { type: 'string', default: '192.168.100.83' },
    output: { type: 'string', default: '.env.lan' },
    release: { type: 'string' },
    scheme: { type: 'string', default: 'https' },
    source: { type: 'string', default: '../grd-dashboard-be/.env' },
  },
  strict: true,
});

if (!values.release || !/^\d{8}-\d{2}$/.test(values.release)) {
  throw new Error('--release must use YYYYMMDD-NN, for example 20261017-01.');
}

if (!values.ip || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(values.ip)) {
  throw new Error('--ip must be an IPv4 address.');
}

if (values.scheme !== 'http' && values.scheme !== 'https') {
  throw new Error('--scheme must be http or https.');
}

const sourcePath = resolve(values.source);
const outputPath = resolve(values.output);
const source = parseEnv(await readFile(sourcePath, 'utf8'));

function literal(value: string | undefined) {
  const normalized = value ?? '';

  if (normalized.includes('\n') || normalized.includes('\r')) {
    throw new Error('Deployment environment values must be single-line.');
  }

  return `'${normalized.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

const variables = {
  GRD_RELEASE: values.release,
  GRD_BACKEND_IMAGE: `grd-dashboard-be:${values.release}`,
  GRD_FRONTEND_IMAGE: `grd-dashboard-fe:${values.scheme === 'http' ? `http-${values.release}` : values.release}`,
  GRD_LAN_IP: values.ip,
  GRD_ORIGIN: `${values.scheme}://${values.ip}`,
  GRD_HTTP_ONLY: values.scheme === 'http' ? 'true' : 'false',
  GRD_DB_NAME: 'grd_dashboard',
  GRD_DB_USER: 'grd_dashboard',
  GRD_DB_PASSWORD: randomBytes(32).toString('hex'),
  GRD_AUTH_SECRET: randomBytes(48).toString('base64url'),
  LOG_LEVEL: source.LOG_LEVEL || 'info',
  UPS_ENVIRONMENT: source.UPS_ENVIRONMENT || 'cie',
  UPS_CLIENT_ID: source.UPS_CLIENT_ID,
  UPS_CLIENT_SECRET: source.UPS_CLIENT_SECRET,
  ECHOSHIP_URL: source.ECHOSHIP_URL || 'https://echoship.com/login',
  ECHOSHIP_USERNAME: source.ECHOSHIP_USERNAME,
  ECHOSHIP_PASSWORD: source.ECHOSHIP_PASSWORD,
  FFE_URL: source.FFE_URL || 'https://www.ffeinc.com/Customer/ShipmentTracking',
  FFE_USERNAME: source.FFE_USERNAME,
  FFE_PASSWORD: source.FFE_PASSWORD,
  NTFY_URL: source.NTFY_URL,
};

const contents = `${Object.entries(variables)
  .map(([key, value]) => `${key}=${literal(value)}`)
  .join('\n')}\n`;

await writeFile(outputPath, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
await chmod(outputPath, 0o600);
console.log(`Created ${outputPath} with mode 600.`);
