import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { releaseFiles, secretFindings } from './prepare-release.mjs';

test('the actual release excludes secrets and local state while retaining examples, notices and CI', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  const files = await releaseFiles(root);
  for (const required of ['.dev.vars.example','.github/workflows/ci.yml','build/sites-vite-plugin.LICENSE','vendor/shadcn-tailwind-4.13.0.LICENSE.md']) assert.ok(files.includes(required));
  for (const file of files) assert.doesNotMatch(file, /^(?:\.dev\.vars$|\.git\/|\.openai\/|\.sites-runtime\/|dist\/|node_modules\/|releases\/)|\.tsbuildinfo$/);
});

test('secret findings identify locations without echoing credentials', () => {
  const key = 'sk-proj-' + 'a'.repeat(40);
  const buffer = Buffer.from(`Example\n${key}\n`);
  const findings = secretFindings(buffer,[key]);
  assert.ok(findings.some(f => f.line === 2 && f.kind === 'API credential'));
  assert.ok(findings.some(f => f.kind === 'local configured credential'));
  assert.ok(!JSON.stringify(findings).includes(key));
  assert.deepEqual(secretFindings(Buffer.from('OPENAI_API_KEY=\nOPENROUTER_API_KEY=\n')),[]);
  assert.ok(secretFindings(Buffer.from(['registry:', '_auth', 'Token=', 'private-value'].join(''))).length);
  assert.ok(secretFindings(Buffer.from(['-----BEGIN','PRIVATE KEY-----'].join(' '))).length);
});

test('exports reject symlinks even when a source path is allowlisted', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'tiny-world-release-'));
  try {
    await mkdir(path.join(root,'.github'));
    await writeFile(path.join(root,'external.txt'),'private material');
    await symlink(path.join(root,'external.txt'),path.join(root,'.github','leak.txt'));
    await assert.rejects(releaseFiles(root),/Symlinks cannot be exported/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
