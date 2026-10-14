import { Router } from 'express';
import { getDatabaseStatus, type DatabaseStatus } from '../db/connection.js';

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  database: DatabaseStatus;
}

export const healthRouter = Router();

/** Liveness check. Always 200 while the process is up; reports the DB connection state. */
healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: getDatabaseStatus(),
  };
  res.json(body);
});
