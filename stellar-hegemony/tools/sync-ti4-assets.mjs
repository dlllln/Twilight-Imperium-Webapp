import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'apps/web/public/ti4');
const checkOnly = process.argv.includes('--check');
const groups = ['factions', 'cards', 'units'];
const records = (
  await Promise.all(
    groups.map(async (group) =>
      JSON.parse(await readFile(resolve(root, `tools/ti4/${group}.json`), 'utf8')),
    ),
  )
).flat();
const digest = (data) => createHash('sha256').update(data).digest('hex');

function targetOf(record) {
  if (
    !/^[a-zA-Z0-9_][a-zA-Z0-9_./-]*\.(png|jpe?g|webp)$/.test(record.path) ||
    record.path.includes('..')
  ) {
    throw new Error(`Invalid asset path: ${record.path}`);
  }
  if (!/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\//.test(record.url)) {
    throw new Error(`Asset URL must pin an upstream commit: ${record.path}`);
  }
  return resolve(destination, record.path);
}

function isImage(data) {
  return (
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (data[0] === 255 && data[1] === 216 && data[2] === 255) ||
    (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP')
  );
}

async function download(record) {
  const response = await fetch(record.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${record.path}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (!isImage(data)) throw new Error(`${record.path}: response is not an image`);
  const target = targetOf(record);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  return { ...record, bytes: data.length, sha256: digest(data) };
}

async function verify(record, saved) {
  const data = await readFile(targetOf(record));
  const previous = saved.find((entry) => entry.path === record.path);
  if (!isImage(data) || previous?.url !== record.url || previous.sha256 !== digest(data)) {
    throw new Error(`${record.path}: image or checksum does not match sources.json`);
  }
  return previous;
}

if (new Set(records.map((record) => record.path)).size !== records.length) {
  throw new Error('Duplicate asset paths in category manifests');
}
const saved = checkOnly
  ? JSON.parse(await readFile(resolve(destination, 'sources.json'), 'utf8'))
  : [];
const output = [];
for (let index = 0; index < records.length; index += 6) {
  output.push(
    ...(await Promise.all(
      records
        .slice(index, index + 6)
        .map((record) => (checkOnly ? verify(record, saved) : download(record))),
    )),
  );
}
if (!checkOnly) {
  await writeFile(resolve(destination, 'sources.json'), `${JSON.stringify(output, null, 2)}\n`);
}
console.log(
  `${checkOnly ? 'Verified' : 'Downloaded'} ${output.length} TI4 images (${(output.reduce((sum, item) => sum + item.bytes, 0) / 1048576).toFixed(1)} MiB).`,
);
