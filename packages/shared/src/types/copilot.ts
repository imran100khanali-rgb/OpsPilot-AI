export interface SourceRecordReference {
  type: 'project' | 'task' | 'approval' | 'collection';
  id: string;
  name: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  url?: string;
}

export interface CopilotSuggestedAction {
  id: string;
  label: string;
  actionType: 'navigate' | 'filter' | 'review_approval';
  targetUrl: string;
  description?: string;
}

export interface CopilotMessage {
  id: string;
  conversationId: string;
  senderType: 'user' | 'assistant' | 'system';
  content: string;
  sourceRecords?: SourceRecordReference[];
  limitations?: string[];
  suggestedActions?: CopilotSuggestedAction[];
  toolCallsExecuted?: Array<{
    toolName: string;
    params: Record<string, unknown>;
  }>;
  createdAt: string;
}

export interface CopilotConversation {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessageSnippet?: string;
}

export interface CopilotChatResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  sourceRecords: SourceRecordReference[];
  limitations: string[];
  suggestedActions: CopilotSuggestedAction[];
  toolCallsExecuted: Array<{
    toolName: string;
    params: Record<string, unknown>;
  }>;
  aiConfigured: boolean;
  provider: string;
  modelUsed: string;
}

export interface AiStatusResponse {
  configured: boolean;
  provider: string;
  model: string;
  hasCredentials: boolean;
  message?: string;
}
