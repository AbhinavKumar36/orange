import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.gradle',
  'coverage',
]);

const SECRET_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Live Razorpay Key', regex: /rzp_live_[0-9a-zA-Z]{14,}/ },
  { name: 'Live Razorpay Secret', regex: /RAZORPAY_KEY_SECRET\s*=\s*(?!exampleSecretKeyString)[0-9a-zA-Z]{20,}/ },
  { name: 'Live Stripe Key', regex: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Personal Access Token', regex: /ghp_[0-9a-zA-Z]{36}/ },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/ },
];

function scanDirectory(dir, findings) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath, findings);
    } else if (stat.isFile()) {
      scanFile(fullPath, findings);
    }
  }
}

function scanFile(filePath, findings) {
  // Skip binary or image files
  if (/\.(png|jpe?g|gif|ico|webp|svg|woff2?|ttf|eot|apk|aab|jar)$/i.test(filePath)) {
    return;
  }

  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  lines.forEach((line, index) => {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: relative(process.cwd(), filePath),
          line: index + 1,
          type: pattern.name,
          content: line.trim().slice(0, 80),
        });
      }
    }
  });
}

const findings = [];
scanDirectory(process.cwd(), findings);

if (findings.length > 0) {
  console.error('\n❌ Potential secrets detected:');
  findings.forEach((f) => {
    console.error(`  - [${f.type}] ${f.file}:${f.line} -> ${f.content}`);
  });
  process.exit(1);
} else {
  console.log('✅ Secret scan completed: No committed secrets detected.');
  process.exit(0);
}

