import { describe, it, expect } from 'vitest';
import { isDirectExecution, startServer } from '../src/server.js';

describe('Server Import & Direct Execution Safety', () => {
  it('isDirectExecution should return false when imported from test runner', () => {
    // When loaded by vitest, process.argv[1] is the vitest runner, not server.ts
    expect(isDirectExecution()).toBe(false);
  });

  it('startServer should be an exported function available for programmatic lifecycle', () => {
    expect(typeof startServer).toBe('function');
  });
});

