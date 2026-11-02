import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const tracked = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

const allFiles = [...tracked, ...untracked]
  .map(f => f.trim().replace(/\r/g, ''))
  .filter(f => {
    if (!f) return false;
    if (f === 'orange.zip') return false;
    if (f.startsWith('node_modules/') || f.includes('/node_modules/')) return false;
    if (f.startsWith('.next/') || f.includes('/.next/')) return false;
    if (f.startsWith('.turbo/') || f.includes('/.turbo/')) return false;
    if (f.startsWith('.gradle/') || f.includes('/.gradle/')) return false;
    if (f.includes('/build/') || f.endsWith('.class') || f.endsWith('.apk')) return false;
    if (f.endsWith('.log')) return false;
    if (f.startsWith('.env') || f.includes('/.env')) return false;
    return true;
  });

console.log(`Packaging ${allFiles.length} clean project files into orange.zip...`);

const listFilePath = path.resolve('.temp_zip_list.txt');
fs.writeFileSync(listFilePath, allFiles.join('\n'), 'utf8');

try {
  if (fs.existsSync('orange.zip')) {
    fs.unlinkSync('orange.zip');
  }
  execSync('tar.exe -a -c -f orange.zip -T .temp_zip_list.txt', { stdio: 'inherit' });
  const stat = fs.statSync('orange.zip');
  console.log(`Successfully generated orange.zip (${stat.size} bytes).`);
} finally {
  if (fs.existsSync(listFilePath)) {
    fs.unlinkSync(listFilePath);
  }
}

