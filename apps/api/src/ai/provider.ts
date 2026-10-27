import { env } from '../config/env.js';
import { logger } from '../utils/safeLogger.js';
import { APPROVED_TOOLS_METADATA } from './tools/definitions.js';

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
    public readonly isRetryable = false,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export class AiRateLimitError extends AiProviderError {
  constructor(message = 'AI provider rate limit reached. Please retry in a moment.') {
    super(message, 429, true);
    this.name = 'AiRateLimitError';
  }
}

export class AiTimeoutError extends AiProviderError {
  constructor(message = 'AI provider request timed out.') {
    super(message, 504, true);
    this.name = 'AiTimeoutError';
  }
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface AiCompletionRequest {
  messages: AiChatMessage[];
  tools?: typeof APPROVED_TOOLS_METADATA;
  temperature?: number;
}

export interface AiCompletionResponse {
  content: string | null;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  tokensUsed?: number;
  model: string;
}

export interface AiProvider {
  name: string;
  isConfigured(): boolean;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}

// -------------------------------------------------------------
// 1. OpenAI-Compatible Adapter
// -------------------------------------------------------------
export class OpenAiProvider implements AiProvider {
  public readonly name = 'openai';

  constructor(
    private readonly apiKey: string = env.OPENAI_API_KEY || '',
    private readonly model: string = env.OPENAI_MODEL || 'gpt-4o-mini',
    private readonly baseUrl: string = env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    private readonly timeoutMs: number = env.AI_REQUEST_TIMEOUT_MS,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (!this.isConfigured()) {
      throw new AiProviderError('OpenAI API key is not configured.', 503, false);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const formattedTools = request.tools?.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const formattedMessages = request.messages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: m.toolCallId,
            content: m.content,
          };
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: 'assistant',
            content: m.content || null,
            tool_calls: m.toolCalls,
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          tools: formattedTools && formattedTools.length > 0 ? formattedTools : undefined,
          temperature: request.temperature ?? 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AiRateLimitError();
        }
        const errorText = await response.text();
        throw new AiProviderError(
          `OpenAI API error (${response.status}): ${errorText.slice(0, 300)}`,
          response.status >= 500 ? 502 : 400,
          response.status >= 500,
        );
      }

      const data = (await response.json()) as {
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: Array<{
              id: string;
              function: {
                name: string;
                arguments: string;
              };
            }>;
          };
        }>;
        usage?: { total_tokens?: number };
      };

      const choice = data.choices[0]?.message;
      if (!choice) {
        throw new AiProviderError('Empty response received from OpenAI API.', 502);
      }

      const parsedToolCalls = choice.tool_calls?.map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      });

      return {
        content: choice.content,
        toolCalls: parsedToolCalls,
        tokensUsed: data.usage?.total_tokens || 0,
        model: this.model,
      };
    } catch (err: unknown) {
      if (err instanceof AiProviderError) {
        throw err;
      }
      if ((err as Error)?.name === 'AbortError') {
        throw new AiTimeoutError(`AI completion timed out after ${this.timeoutMs}ms.`);
      }
      logger.error('AI provider request failed', { error: (err as Error)?.message });
      throw new AiProviderError(
        `AI provider connection failed: ${(err as Error)?.message || 'Unknown network error'}`,
        502,
        true,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// -------------------------------------------------------------
// 2. Deterministic Grounded Engine (Local/Fallback Provider)
// -------------------------------------------------------------
export class LocalDeterministicProvider implements AiProvider {
  public readonly name = 'local-deterministic';

  isConfigured(): boolean {
    return true; // Always operational locally
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const userPrompt =
      request.messages
        .filter((m) => m.role === 'user')
        .pop()
        ?.content?.toLowerCase() || '';

    // If this is step 2 (tool results provided back as messages), synthesize grounded answer
    const toolMessages = request.messages.filter((m) => m.role === 'tool');
    if (toolMessages.length > 0) {
      return this.synthesizeToolResults(toolMessages, userPrompt);
    }

    // Step 1: Detect Intent & Route to Approved Tool
    const lower = userPrompt.toLowerCase();

    // Check for prompt injection attempts
    const isInjectionAttempt =
      lower.includes('ignore previous instructions') ||
      lower.includes('disregard all') ||
      lower.includes('system prompt') ||
      lower.includes('dan mode') ||
      lower.includes('jailbreak') ||
      lower.includes('drop table') ||
      lower.includes('select * from');

    if (isInjectionAttempt) {
      return {
        content:
          'Security Notice: Input manipulation or unauthorized instruction override attempt was detected. OpsPilot AI adheres strictly to tenant data isolation and read-only parameterized operations. Proceeding with standard organizational inquiry.',
        tokensUsed: 40,
        model: this.name,
      };
    }

    // Intent: Overdue work / tasks past deadline / collections
    if (
      lower.includes('overdue') ||
      lower.includes('past due') ||
      lower.includes('late') ||
      lower.includes('sla breach') ||
      lower.includes('delayed')
    ) {
      const category =
        lower.includes('collection') || lower.includes('invoice') ? 'collections' : 'all';
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_overdue_' + Date.now(),
            name: 'get_overdue_work',
            arguments: { category, limit: 10 },
          },
        ],
        tokensUsed: 25,
        model: this.name,
      };
    }

    // Intent: Approvals
    if (
      lower.includes('approval') ||
      lower.includes('sign off') ||
      lower.includes('pending review') ||
      lower.includes('approve')
    ) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_approvals_' + Date.now(),
            name: 'get_pending_approvals',
            arguments: { limit: 10 },
          },
        ],
        tokensUsed: 20,
        model: this.name,
      };
    }

    // Intent: Blocked work / blocked projects / blockers
    if (lower.includes('blocked') || lower.includes('blocker') || lower.includes('stuck')) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_blocked_projects_' + Date.now(),
            name: 'get_projects',
            arguments: { status: 'blocked', limit: 10 },
          },
        ],
        tokensUsed: 25,
        model: this.name,
      };
    }

    // Intent: Specific project details inquiry
    const projectMatch = lower.match(/project\s+([a-zA-Z0-9_-]+)/);
    if (
      projectMatch &&
      !['titan', 'overview', 'summary', 'list', 'status'].includes(projectMatch[1]!)
    ) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_project_search_' + Date.now(),
            name: 'get_projects',
            arguments: { search: projectMatch[1], limit: 5 },
          },
        ],
        tokensUsed: 25,
        model: this.name,
      };
    }

    // Intent: Projects overview / active projects
    if (lower.includes('project')) {
      const status = lower.includes('active')
        ? 'active'
        : lower.includes('completed')
          ? 'completed'
          : 'all';
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_projects_' + Date.now(),
            name: 'get_projects',
            arguments: { status, limit: 10 },
          },
        ],
        tokensUsed: 25,
        model: this.name,
      };
    }

    // Intent: Tasks overview
    if (
      lower.includes('task') ||
      lower.includes('urgent') ||
      lower.includes('todo') ||
      lower.includes('in progress')
    ) {
      const priority = lower.includes('urgent')
        ? 'urgent'
        : lower.includes('high')
          ? 'high'
          : 'all';
      const status = lower.includes('todo')
        ? 'todo'
        : lower.includes('in progress')
          ? 'in_progress'
          : 'all';
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_tasks_' + Date.now(),
            name: 'get_tasks',
            arguments: { status, priority, limit: 10 },
          },
        ],
        tokensUsed: 25,
        model: this.name,
      };
    }

    // Default intent: Executive Dashboard metrics overview
    return {
      content: null,
      toolCalls: [
        {
          id: 'call_metrics_' + Date.now(),
          name: 'get_dashboard_metrics',
          arguments: { timeframe: '30d' },
        },
      ],
      tokensUsed: 20,
      model: this.name,
    };
  }

  private synthesizeToolResults(
    toolMessages: AiChatMessage[],
    _userPrompt: string,
  ): AiCompletionResponse {
    let combinedAnswer = '';

    for (const msg of toolMessages) {
      try {
        const payload = JSON.parse(msg.content);
        const { toolName, data, error } = payload;

        if (error) {
          combinedAnswer += `Unable to complete query via ${toolName}: ${error}\n`;
          continue;
        }

        if (toolName === 'get_projects') {
          const projects = data.projects as Array<{
            id: string;
            name: string;
            status: string;
            taskCount: number;
            completedTaskCount: number;
            blockedTaskCount: number;
          }>;
          if (projects.length === 0) {
            combinedAnswer += `No matching projects were found within your organization.\n`;
          } else {
            combinedAnswer += `Found ${projects.length} project(s):\n`;
            for (const p of projects) {
              const blockedText =
                p.blockedTaskCount > 0 ? ` (${p.blockedTaskCount} task(s) blocked)` : '';
              combinedAnswer += `• **${p.name}** — Status: \`${p.status}\`, Tasks: ${p.completedTaskCount}/${p.taskCount} completed${blockedText}.\n`;
            }
          }
        } else if (toolName === 'get_tasks') {
          const tasks = data.tasks as Array<{
            id: string;
            title: string;
            status: string;
            priority: string;
            dueDate?: string;
            isOverdue?: boolean;
            projectName?: string;
          }>;
          if (tasks.length === 0) {
            combinedAnswer += `No matching tasks were found within your organization.\n`;
          } else {
            combinedAnswer += `Found ${tasks.length} task(s):\n`;
            for (const t of tasks) {
              const overdueText = t.isOverdue ? ' ⚠️ **OVERDUE**' : '';
              const due = t.dueDate ? ` (Due: ${new Date(t.dueDate).toLocaleDateString()})` : '';
              combinedAnswer += `• **${t.title}** — Status: \`${t.status}\`, Priority: \`${t.priority}\`${due}${overdueText} [${t.projectName || 'General'}].\n`;
            }
          }
        } else if (toolName === 'get_overdue_work') {
          const { overdueTasks, overdueCollections } = data as {
            overdueTasks: Array<{
              title: string;
              days_overdue: number;
              priority: string;
              project_name: string;
            }>;
            overdueCollections: Array<{
              customer_name: string;
              invoice_number: string;
              amount: string;
              days_overdue: number;
            }>;
          };
          const totalOverdue = (overdueTasks?.length || 0) + (overdueCollections?.length || 0);
          if (totalOverdue === 0) {
            combinedAnswer += `No overdue work or overdue collections found in your organization. All operational deadlines are currently on schedule.\n`;
          } else {
            combinedAnswer += `Identified ${totalOverdue} overdue item(s) requiring attention:\n`;
            if (overdueTasks && overdueTasks.length > 0) {
              combinedAnswer += `\n**Overdue Tasks (${overdueTasks.length}):**\n`;
              for (const t of overdueTasks) {
                combinedAnswer += `• **${t.title}** (${t.project_name || 'General'}) — ${t.days_overdue} day(s) overdue. Priority: \`${t.priority}\`.\n`;
              }
            }
            if (overdueCollections && overdueCollections.length > 0) {
              combinedAnswer += `\n**Overdue Invoices / Collections (${overdueCollections.length}):**\n`;
              for (const c of overdueCollections) {
                combinedAnswer += `• **${c.customer_name}** (${c.invoice_number}) — $${Number(c.amount).toLocaleString()} overdue by ${c.days_overdue} day(s).\n`;
              }
            }
          }
        } else if (toolName === 'get_pending_approvals') {
          const approvals = data.pendingApprovals as Array<{
            id: string;
            title: string;
            requester_name: string;
            created_at: string;
          }>;
          if (approvals.length === 0) {
            combinedAnswer += `No pending approvals found. All workflow requests have been decided.\n`;
          } else {
            combinedAnswer += `There are ${approvals.length} pending approval request(s) awaiting review:\n`;
            for (const a of approvals) {
              combinedAnswer += `• **${a.title}** requested by ${a.requester_name} on ${new Date(a.created_at).toLocaleDateString()}.\n`;
            }
          }
        } else if (toolName === 'get_dashboard_metrics') {
          const m = data as {
            activeProjects: number;
            blockedProjects: number;
            totalTasks: number;
            completedTasks: number;
            overdueTasks: number;
            pendingApprovals: number;
            collectionFollowUps: number;
            completionRate: string;
          };
          combinedAnswer += `**Executive Operations Summary:**\n`;
          combinedAnswer += `• **Active Projects:** ${m.activeProjects} (${m.blockedProjects} blocked)\n`;
          combinedAnswer += `• **Task Completion Velocity:** ${m.completedTasks} / ${m.totalTasks} completed (${m.completionRate})\n`;
          combinedAnswer += `• **Overdue Tasks:** ${m.overdueTasks} item(s) past SLA\n`;
          combinedAnswer += `• **Pending Sign-offs:** ${m.pendingApprovals} approval(s)\n`;
          combinedAnswer += `• **Collection Follow-ups:** ${m.collectionFollowUps} overdue receivable(s)\n`;
        }
      } catch {
        combinedAnswer += `Retrieved operational data for your organization.\n`;
      }
    }

    return {
      content: combinedAnswer.trim() || 'No relevant operational records found for this inquiry.',
      tokensUsed: 60,
      model: this.name,
    };
  }
}

// -------------------------------------------------------------
// Provider Factory
// -------------------------------------------------------------
let cachedProvider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    cachedProvider = new OpenAiProvider();
  } else {
    // Default to deterministic local provider
    cachedProvider = new LocalDeterministicProvider();
  }

  return cachedProvider;
}

export function setAiProviderForTesting(provider: AiProvider | null): void {
  cachedProvider = provider;
}
