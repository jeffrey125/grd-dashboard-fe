import { readFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { resolve } from 'node:path';

const [directory, frame] = process.argv.slice(2);
const match = frame?.match(/^(assets\/[A-Za-z0-9_.-]+\.js):(\d+):(\d+)$/);
if (!directory || !match)
  throw new Error(
    'Usage: node scripts/resolve-frontend-frame.mjs <private-release-directory> assets/<bundle>.js:<line>:<column>',
  );
const map = new SourceMap(JSON.parse(readFileSync(resolve(directory, `${match[1]}.map`), 'utf8')));
const entry = map.findEntry(Number(match[2]) - 1, Number(match[3]) - 1);
if (!entry.originalSource) throw new Error('No source mapping for this frame');
console.log(
  `${entry.originalSource}:${entry.originalLine + 1}:${entry.originalColumn + 1}${entry.name ? ` (${entry.name})` : ''}`,
);
