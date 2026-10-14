import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/**
 * Starts ONE ephemeral mongod for the whole test run (test files run in parallel and
 * each one uses its own database on it). Starting one per file races on the binary lock.
 */
export default async function setup(project: TestProject) {
  const mongo = await MongoMemoryServer.create();
  project.provide('mongoUri', mongo.getUri());
  return async () => {
    await mongo.stop();
  };
}
