import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/pool.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { NotFoundError } from '../../utils/errors.js';
import { CreateSystemSchema, PaginationQuerySchema, System } from '@opspilot/shared';

const router = Router();

/**
 * GET /api/v1/systems
 * List monitored enterprise systems with pagination
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParams = PaginationQuerySchema.parse(req.query);
    const offset = (queryParams.page - 1) * queryParams.limit;

    const countResult = await query<{ count: string }>('SELECT COUNT(*) FROM systems');
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const systemsResult = await query<System>(
      `SELECT id, name, slug, description, status, environment,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM systems
       ORDER BY name ASC
       LIMIT $1 OFFSET $2`,
      [queryParams.limit, offset],
    );

    return sendSuccess(
      res,
      {
        items: systemsResult.rows,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          total,
          totalPages: Math.ceil(total / queryParams.limit),
        },
      },
      200,
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/systems/:id
 * Retrieve a single monitored system by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await query<System>(
      `SELECT id, name, slug, description, status, environment,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM systems
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('System', id);
    }

    return sendSuccess(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/systems
 * Register a new system for enterprise monitoring
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = CreateSystemSchema.parse(req.body);

    const result = await query<System>(
      `INSERT INTO systems (name, slug, description, status, environment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, slug, description, status, environment,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        validatedData.name,
        validatedData.slug,
        validatedData.description || null,
        validatedData.status,
        validatedData.environment,
      ],
    );

    req.log?.info(`Registered new monitored system: ${validatedData.name}`, {
      systemId: result.rows[0]?.id,
    });

    return sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    next(error);
  }
});

export default router;
