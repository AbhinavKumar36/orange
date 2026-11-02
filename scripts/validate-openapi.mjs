import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseYaml } = require('@redocly/openapi-core');

export function validateOpenApiFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    parseYaml(content);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPath = path.resolve(__dirname, '../packages/api-contracts/openapi.yaml');

const targetPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : defaultPath;

if (!fs.existsSync(targetPath)) {
  console.error(`Target file does not exist: ${targetPath}`);
  process.exit(1);
}

const result = validateOpenApiFile(targetPath);
if (!result.valid) {
  console.error(`❌ Duplicate key or syntax error in ${targetPath}:`);
  console.error(result.error);
  process.exit(1);
} else {
  console.log(`✅ OpenAPI duplicate key validation passed: ${targetPath}`);
}
