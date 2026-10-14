import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Starts a single in-memory MongoDB for all integration tests.
    globalSetup: ['./src/test/globalSetup.ts'],
    // The mongod binary may need to be downloaded on the first run.
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
