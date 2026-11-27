import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scanner = fileURLToPath(new URL('../../../scripts/secret-scan.mjs', import.meta.url));
function scan(content: string) {
  const dir = mkdtempSync(join(tmpdir(), 'orange-secret-scan-'));
  const file = join(dir, 'fixture.ts');
  try {
    writeFileSync(file, content);
    return spawnSync(process.execPath, [scanner], { cwd: dir, encoding: 'utf8' });
  } finally {
    unlinkSync(file);
    rmdirSync(dir);
  }
}
function jwt(role: string) {
  return ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'fixture-signature'].join('.');
}
describe('Repository credential scan', () => {
  it('detects a quoted privileged JWT on a separate line without printing it', () => {
    const token = jwt('service_role');
    const result = scan(`const arbitraryName =\n  '${token}';`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('fixture.ts:2');
    expect(result.stderr).not.toContain(token);
  });
  it('permits public anon JWTs', () => {
    expect(scan(`const key = '${jwt('anon')}';`).status).toBe(0);
  });
  it('detects modern Supabase secret keys without printing them', () => {
    const token = 'sb_' + 'secret_' + 'a'.repeat(32);
    const result = scan(`const key = '${token}';`);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain(token);
  });
});
