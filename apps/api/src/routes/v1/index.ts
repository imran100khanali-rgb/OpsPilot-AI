import { Router } from 'express';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import projectsRoutes from './projects.routes.js';
import tasksRoutes from './tasks.routes.js';
import approvalsRoutes from './approvals.routes.js';
import adminRoutes from './admin.routes.js';
import systemsRoutes from './systems.routes.js';
import { copilotRouter } from './copilot.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/projects', projectsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/approvals', approvalsRoutes);
router.use('/admin', adminRoutes);
router.use('/systems', systemsRoutes);
router.use('/copilot', copilotRouter);

export default router;
