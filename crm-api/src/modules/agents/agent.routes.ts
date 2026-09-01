import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { agentSchema, listAgentsQuery } from './agent.schema.js';
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from './agent.service.js';

export const agentRouter = Router();

agentRouter.use(requireAuth);

agentRouter.get(
  '/',
  validateQuery(listAgentsQuery),
  requirePermission('agent', 'view'),
  asyncHandler(async (req, res) => {
    const { search, page, pageSize } = req.query as unknown as {
      search?: string;
      page: number;
      pageSize: number;
    };
    res.json(await listAgents(search, page, pageSize));
  }),
);

agentRouter.get('/:id', requirePermission('agent', 'view'), asyncHandler(async (req, res) => {
  res.json(await getAgent(Number(req.params.id)));
}));

agentRouter.post(
  '/',
  validate(agentSchema),
  requirePermission('agent', 'create'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createAgent(req.body));
  }),
);

agentRouter.put('/:id', validate(agentSchema), requirePermission('agent', 'edit'), asyncHandler(async (req, res) => {
  res.json(await updateAgent(Number(req.params.id), req.body));
}));

agentRouter.delete('/:id', requirePermission('agent', 'delete'), asyncHandler(async (req, res) => {
  await deleteAgent(Number(req.params.id));
  res.json({ success: true });
}));