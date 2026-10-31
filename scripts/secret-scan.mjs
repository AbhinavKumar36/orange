import { readFileSync, readdirSync, lstatSync } from 'node:fs';
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

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.apk', '.aab', '.jar',
  '.lock', '.bin', '.tar', '.gz', '.zip'
]);

const SECRET_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'Live Razorpay Key', regex: /rzp_live_[0-9a-zA-Z]{14,}/ },
  { name: 'Live Razorpay Secret', regex: /RAZORPAY_KEY_SECRET\s*=\s*(?!exampleSecretKeyString)[0-9a-zA-Z]{20,}/ },
  { name: 'Live Stripe Key', regex: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Access Key', regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/ },
  { name: 'GitHub Token', regex: /gh[pousr]_[0-9a-zA-Z]{36}/ },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\\-_]{35}/ },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/ },
  {
    name: 'Production Supabase Service Key',
    regex: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.(?!example_service_role_key)[0-9a-zA-Z_-]{20,}/,
  },
  {
    name: 'Database URI with Password',
    regex: /(?:postgres|postgresql|mysql|mongodb):\/\/[^:\s]+:(?!postgres@localhost)[^@\s]{4,}@[^/\s]+/,
  },
];

let scannedFilesCount = 0;
const unreadableFiles = [];
const findings = [];

function isBinary(buffer) {
  // Check the first 8000 bytes for null bytes
  const length = Math.min(buffer.length, 8000);
  for (let i = 0; i < length; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function scanDirectory(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    unreadableFiles.push({ path: relative(process.cwd(), dir), error: err.message });
    return;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);

    let stat;
    try {
      stat = lstatSync(fullPath);
    } catch (err) {
      unreadableFiles.push({ path: relative(process.cwd(), fullPath), error: err.message });
      continue;
    }

    // Handle symlinks safely: do not follow symlinks to directories to prevent infinite loops
    if (stat.isSymbolicLink()) {
      continue;
    }

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (stat.isFile()) {
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return;
  }

  let buffer;
  try {
    buffer = readFileSync(filePath);
  } catch (err) {
    unreadableFiles.push({ path: relative(process.cwd(), filePath), error: err.message });
    return;
  }

  if (isBinary(buffer)) {
    return;
  }

  scannedFilesCount++;
  const content = buffer.toString('utf-8');
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

scanDirectory(process.cwd());

if (unreadableFiles.length > 0) {
  console.warn(`⚠️ Warning: ${unreadableFiles.length} file(s) could not be read:`);
  unreadableFiles.forEach((f) => console.warn(`  - ${f.path}: ${f.error}`));
}

if (findings.length > 0) {
  console.error(`\n❌ Secret scan failed: ${findings.length} potential secret(s) detected across ${scannedFilesCount} files:`);
  findings.forEach((f) => {
    console.error(`  - [${f.type}] ${f.file}:${f.line} -> ${f.content}`);
  });
  process.exit(1);
} else {
  console.log(`✅ Secret scan completed: ${scannedFilesCount} files checked. Zero committed secrets detected.`);
  process.exit(0);
}
