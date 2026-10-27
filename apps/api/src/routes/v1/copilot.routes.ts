import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { CopilotService } from '../../services/copilot.service.js';
import { CreateConversationSchema, SendMessageSchema } from '@opspilot/shared';
import { env } from '../../config/env.js';

const router = Router();

// All copilot routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/copilot/status
 * Check AI copilot status and configuration
 */
router.get('/status', (_req: Request, res: Response) => {
  const hasCredentials = Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0);
  const statusPayload = {
    configured: hasCredentials,
    provider: env.AI_PROVIDER,
    model: env.OPENAI_MODEL,
    hasCredentials,
    message: hasCredentials
      ? 'AI provider is connected and configured.'
      : 'OpenAI API key is not configured in .env. Running on local deterministic operational copilot mode.',
  };

  return sendSuccess(res, statusPayload);
});

/**
 * GET /api/v1/copilot/conversations
 * List conversation threads for current user in organization
 */
router.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const conversations = await CopilotService.listConversations(user.organizationId, user.id);
    return sendSuccess(res, conversations);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/copilot/conversations
 * Create a new conversation thread
 */
router.post('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const parsed = CreateConversationSchema.parse(req.body);
    const convId = await CopilotService.getOrCreateConversation(
      user.organizationId,
      user.id,
      undefined,
      parsed.title,
    );
    const result = await CopilotService.getConversation(convId, user.organizationId);
    return sendSuccess(res, result?.conversation || { id: convId }, 201);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/copilot/conversations/:id
 * Retrieve a conversation and its messages
 */
router.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const conv = await CopilotService.getConversation(req.params.id as string, user.organizationId);
    if (!conv) {
      return sendError(res, 404, 'NOT_FOUND', 'Conversation not found or not accessible');
    }
    return sendSuccess(res, conv);
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/v1/copilot/conversations/:id
 * Delete a conversation thread
 */
router.delete('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const deleted = await CopilotService.deleteConversation(
      req.params.id as string,
      user.organizationId,
      user.id,
    );
    if (!deleted) {
      return sendError(res, 404, 'NOT_FOUND', 'Conversation not found');
    }
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/copilot/chat
 * Ask questions, execute approved tools, and receive grounded answers
 */
router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const parsed = SendMessageSchema.parse(req.body);

    const chatResponse = await CopilotService.processMessage({
      organizationId: user.organizationId,
      userId: user.id,
      userRole: user.role,
      message: parsed.message,
      conversationId: parsed.conversationId,
    });

    return sendSuccess(res, chatResponse);
  } catch (err) {
    return next(err);
  }
});

export const copilotRouter = router;
