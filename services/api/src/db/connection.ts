import mongoose from 'mongoose';

export type DatabaseStatus = 'disconnected' | 'connected' | 'connecting' | 'disconnecting';

const STATUS_BY_READY_STATE: Record<number, DatabaseStatus> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/** Removes credentials from a MongoDB URI so it can be logged safely. */
export function redactMongoUri(uri: string): string {
  return uri.replace(/\/\/([^@/]+)@/, '//***:***@');
}

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (error: Error) => {
    console.error('[db] MongoDB connection error:', error.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  const connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  console.info(`[db] Connected to MongoDB at ${redactMongoUri(uri)}`);
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function getDatabaseStatus(): DatabaseStatus {
  return STATUS_BY_READY_STATE[mongoose.connection.readyState] ?? 'disconnected';
}
