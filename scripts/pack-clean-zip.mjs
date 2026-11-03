import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const tracked = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

const allFiles = [...tracked, ...untracked]
  .map(f => f.trim().replace(/\r/g, ''))
  .filter(f => {
    if (!f) return false;
    if (f === 'orange.zip' || f === '.orange_temp.zip' || f === '.temp_zip_list.txt') return false;
    if (f.startsWith('node_modules/') || f.includes('/node_modules/')) return false;
    if (f.startsWith('.next/') || f.includes('/.next/')) return false;
    if (f.startsWith('.turbo/') || f.includes('/.turbo/')) return false;
    if (f.startsWith('.gradle/') || f.includes('/.gradle/')) return false;
    if (f.includes('/build/') || f.endsWith('.class') || f.endsWith('.apk')) return false;
    if (f.endsWith('.log')) return false;
    if (f.endsWith('.example')) return true;
    if (f === '.env' || f.endsWith('/.env') || f.includes('/.env.') || f.startsWith('.env.')) return false;
    return true;
  });

console.log(`Packaging ${allFiles.length} clean project files into orange.zip...`);

const listFilePath = path.resolve('.temp_zip_list.txt');
fs.writeFileSync(listFilePath, allFiles.join('\n'), 'utf8');

const targetZip = path.resolve('orange.zip');
const tempZip = path.resolve('.orange_temp.zip');

try {
  if (fs.existsSync(tempZip)) {
    fs.unlinkSync(tempZip);
  }
  execSync(`tar.exe -a -c -f "${tempZip}" -T "${listFilePath}"`, { stdio: 'inherit' });
  const stat = fs.statSync(tempZip);
  console.log(`Generated archive in temp (${stat.size} bytes). Copying to ${targetZip}...`);
  fs.copyFileSync(tempZip, targetZip);
  console.log(`Successfully updated ${targetZip} (${fs.statSync(targetZip).size} bytes).`);
} finally {
  if (fs.existsSync(listFilePath)) {
    fs.unlinkSync(listFilePath);
  }
}

