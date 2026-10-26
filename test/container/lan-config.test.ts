import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { parseEnv, promisify } from 'node:util';

const execute = promisify(execFile);

test('LAN environment passes provider credentials only to the worker', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'grd-fe-lan-config-'));
  const sourceFile = join(directory, 'source.env');
  const envFile = join(directory, 'lan.env');

  try {
    await writeFile(
      sourceFile,
      [
        'QUOTE_COMPARISON_ENABLED=false',
        'AMAZON_SP_API_CLIENT_ID=fixture-client',
        'AMAZON_SP_API_CLIENT_SECRET=fixture-secret',
        'AMAZON_SP_API_REFRESH_TOKEN=fixture-refresh',
        'MYUNISHIPPERS_EMAIL=quote-user@example.test',
        'MYUNISHIPPERS_PASSWORD=disposable-password',
        '',
      ].join('\n'),
    );
    await execute(
      'node',
      [
        resolve('scripts/prepare-lan-env.ts'),
        '--release',
        '20261022-99',
        '--source',
        sourceFile,
        '--output',
        envFile,
      ],
      { timeout: 30_000 },
    );

    const generated = parseEnv(await readFile(envFile, 'utf8'));
    const mode = (await stat(envFile)).mode & 0o777;

    assert.equal(generated.MYUNISHIPPERS_EMAIL, 'quote-user@example.test');
    assert.equal(generated.MYUNISHIPPERS_PASSWORD, 'disposable-password');
    assert.equal(mode, 0o600);
    assert.equal(generated.QUOTE_COMPARISON_ENABLED, 'false');
    assert.equal(generated.AMAZON_SP_API_CLIENT_ID, 'fixture-client');
    assert.equal(generated.AMAZON_SP_API_CLIENT_SECRET, 'fixture-secret');
    assert.equal(generated.AMAZON_SP_API_REFRESH_TOKEN, 'fixture-refresh');
    assert.equal(generated.AMAZON_SP_API_SANDBOX_CLIENT_ID, undefined);

    const { stdout } = await execute(
      'docker',
      [
        'compose',
        '--profile',
        'worker',
        '--env-file',
        envFile,
        '-f',
        resolve('docker-compose.lan.yml'),
        'config',
        '--format',
        'json',
      ],
      { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const configuration = JSON.parse(stdout) as {
      services: Record<string, { environment?: Record<string, string> }>;
    };

    assert.equal(
      configuration.services.worker?.environment?.MYUNISHIPPERS_EMAIL,
      'quote-user@example.test',
    );
    assert.equal(
      configuration.services.worker?.environment?.MYUNISHIPPERS_PASSWORD,
      'disposable-password',
    );
    assert.equal(configuration.services.api?.environment?.MYUNISHIPPERS_EMAIL, undefined);
    assert.equal(configuration.services.api?.environment?.QUOTE_COMPARISON_ENABLED, 'false');
    assert.equal(configuration.services.worker?.environment?.QUOTE_COMPARISON_ENABLED, 'false');
    for (const [key, value] of Object.entries({
      AMAZON_SP_API_CLIENT_ID: 'fixture-client',
      AMAZON_SP_API_CLIENT_SECRET: 'fixture-secret',
      AMAZON_SP_API_REFRESH_TOKEN: 'fixture-refresh',
    })) {
      assert.equal(configuration.services.worker?.environment?.[key], value);
      assert.equal(configuration.services.api?.environment?.[key], undefined);
    }
    assert.equal(
      configuration.services.worker?.environment?.AMAZON_SP_API_SANDBOX_CLIENT_ID,
      undefined,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
