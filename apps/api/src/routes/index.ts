import { Router } from 'express';
import healthRoutes from './health.routes.js';
import v1Routes from './v1/index.js';

const router = Router();

// Health checks available at /api/health
router.use('/health', healthRoutes);

// Versioned API endpoints
router.use('/v1', v1Routes);

export default router;
