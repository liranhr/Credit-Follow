import { Router } from 'express';
import { z } from 'zod';
import type { ApiDeps } from '../deps.js';
import { getValidated, validate } from '../middleware/validate.js';
import { buildDashboard } from '../services/finance.service.js';
import { loadUser } from './loadUser.js';

const dashboardSchemas = {
  query: z.object({ cycleOffset: z.coerce.number().int().min(-36).max(0).default(0) }),
};

export function createDashboardRouter(deps: ApiDeps): Router {
  const router = Router();

  router.get('/', validate(dashboardSchemas), async (_req, res) => {
    const user = await loadUser(res);
    const { cycleOffset } = getValidated(res, dashboardSchemas).query;
    res.json(await buildDashboard(user, deps.now(), cycleOffset));
  });

  return router;
}
