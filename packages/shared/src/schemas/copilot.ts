import { z } from 'zod';

export const SendMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
  conversationId: z.string().uuid().optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
