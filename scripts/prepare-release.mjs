import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Only these project paths can enter an export, regardless of the parent Git repository.
const sourcePaths = [
  '.github', '.gitignore', '.npmrc', '.nvmrc', '.dev.vars.example',
  'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md',
  'app', 'build', 'components', 'db', 'docs', 'drizzle', 'examples', 'hooks', 'lib', 'public', 'scripts', 'vendor',
  'cloudflare-env.d.ts', 'components.json', 'drizzle.config.ts', 'eslint.config.mjs',
  'next.config.ts', 'package.json', 'package-lock.json', 'postcss.config.mjs', 'tsconfig.json', 'vite.config.ts',
];
const excluded = /^(?:\.git|\.openai|\.sites-runtime|\.agents|\.codex|\.next|\.vinext|\.wrangler|node_modules|dist|releases|coverage|\.DS_Store)$|^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$|\.(?:pem|key|log|tsbuildinfo)$/;

export async function releaseFiles(root) {
  const files = [];
  async function visit(relative) {
    if (relative !== '.dev.vars.example' && relative.split('/').some(part => excluded.test(part))) return;
    const stat = await lstat(path.join(root, relative));
    if (stat.isSymbolicLink()) throw new Error(`Symlinks cannot be exported: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of (await readdir(path.join(root, relative))).sort()) await visit(`${relative}/${name}`);
    } else if (stat.isFile()) files.push(relative);
  }
  for (const relative of sourcePaths) await visit(relative);
  for (const license of ['LICENSE', 'LICENSE.proposed']) {
    try { await visit(license); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!files.includes('LICENSE') && !files.includes('LICENSE.proposed')) throw new Error('A project license or explicit proposal is required.');
  return files.sort();
}

export function secretFindings(content, knownSecrets = []) {
  const findings = [];
  const text = content.toString('utf8');
  const patterns = [
    ['API credential', /\b(?:sk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['registry credential', /(?:_authToken|_password)\s*=\s*(?!\$\{)\S+/],
    ['private workstation path', /\/(?:Users|home)\/[A-Za-z0-9_.-]+\//],
  ];
  text.split('\n').forEach((line, index) => {
    for (const [kind, pattern] of patterns) if (pattern.test(line)) findings.push({ line: index + 1, kind });
  });
  if (knownSecrets.some(secret => secret && content.includes(Buffer.from(secret)))) findings.push({ kind: 'local configured credential' });
  return findings; // Never include matched secret values in logs or reports.
}

async function main() {
  const mode = process.argv[2];
  if (!['--check', '--pack'].includes(mode)) throw new Error('Use --check or --pack.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const files = await releaseFiles(root);
  let knownSecrets = [];
  try {
    const vars = await readFile(path.join(root, '.dev.vars'), 'utf8');
    knownSecrets = vars.split('\n').filter(line => /^(?:OPENAI_API_KEY|OPENROUTER_API_KEY)=/.test(line)).map(line => line.slice(line.indexOf('=') + 1).trim().replace(/^(["'])(.*)\1$/, '$2')).filter(Boolean);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const manifest = [];
  const findings = [];
  for (const file of files) {
    const content = await readFile(path.join(root, file));
    findings.push(...secretFindings(content, knownSecrets).map(finding => ({ file, ...finding })));
    manifest.push({ path: file, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
  }
  if (findings.length) {
    for (const finding of findings) console.error(`${finding.file}${finding.line ? `:${finding.line}` : ''}: ${finding.kind}`);
    throw new Error('Release source check failed. No archive created.');
  }
  console.log(`Checked ${files.length} allowlisted files. No configured credentials or scanned secret patterns found.`);
  console.log('Licensing, asset rights, key rotation and publication review remain manual checks; see docs/release-checklist.md.');
  if (mode === '--check') return;
  const releases = path.join(root, 'releases');
  const destination = path.join(releases, 'tiny-world');
  await mkdir(releases, { recursive: true });
  await mkdir(destination); // Fail instead of overwriting a previous review export.
  for (const file of files) {
    const target = path.join(destination, file);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, file), target, { errorOnExist: true, force: false });
  }
  await writeFile(path.join(destination, 'RELEASE_MANIFEST.json'), JSON.stringify({ files: manifest }, null, 2) + '\n');
  const archive = path.join(releases, 'tiny-world.tar.gz');
  try { await lstat(archive); throw new Error('Archive already exists; move the previous export before packing again.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const packed = spawnSync('tar', ['-czf', archive, '-C', releases, 'tiny-world'], { stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } });
  if (packed.error) throw packed.error;
  if (packed.status !== 0) throw new Error('Could not create archive; the source directory is available for review.');
  console.log('Prepared releases/tiny-world/ and releases/tiny-world.tar.gz. Nothing has been published.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
