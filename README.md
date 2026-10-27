# OpsPilot AI - Enterprise Operations Intelligence Platform

An enterprise-grade, multi-tenant operations intelligence platform built with **Next.js App Router**, **Node.js/Express**, **PostgreSQL**, **Zod**, and **Vitest**.

---

## 1. Monorepo Architecture

```
opspilot-ai/
├── apps/
│   ├── api/                 # Express, Node.js, PostgreSQL (pg), Argon2id/Bcrypt, Vitest
│   │   ├── src/
│   │   │   ├── config/      # Zod-validated environment configurations
│   │   │   ├── db/          # pg.Pool, transactional migrator, rollback engine, SQL migrations
│   │   │   ├── middlewares/ # authenticate, requireAuth, requireRole, requireCsrf, requestId, logger
│   │   │   ├── routes/      # health, auth, projects, approvals, admin, systems
│   │   │   ├── services/    # session.service (SHA-256 session token hashing, CSRF secrets)
│   │   │   └── utils/       # safeLogger (redaction), apiResponse, errors, password (bcrypt)
│   │   └── __tests__/       # Security, Multi-Tenant, RBAC, CSRF, Health tests
│   └── web/                 # Next.js 15 App Router, React 19, TypeScript dashboard
│       └── src/
│           ├── app/         # App Router pages and dark theme CSS tokens
│           └── components/  # Infrastructure Health, MetricCards, SystemsGrid, IncidentList
├── packages/
│   └── shared/              # Shared types, Zod schemas, role contracts
├── .env.example             # Root configuration reference template
├── tsconfig.base.json       # Monorepo TypeScript base configuration
└── package.json             # Workspaces and root orchestration scripts
```

---

## 2. PostgreSQL Migrations & Multi-Tenant Schema

The platform uses a lightweight, transactional SQL migration runner tracking migrations via `schema_migrations`.

### Schema Summary

| Table                 | Description                                                         |   Multi-Tenant Scoped   |
| --------------------- | ------------------------------------------------------------------- | :---------------------: |
| `organizations`       | Root tenant entity with unique slug and timestamps                  |          Root           |
| `users`               | Organization-scoped users (`Director`, `Manager`, `Admin`)          | Yes (`organization_id`) |
| `sessions`            | Server-side sessions with SHA-256 token hashing and CSRF secrets    | Yes (`organization_id`) |
| `projects`            | Monitored initiatives and operations scopes                         | Yes (`organization_id`) |
| `tasks`               | Action items tied to projects and assigned users                    | Yes (`organization_id`) |
| `approvals`           | Operational change approvals requiring Director or Admin review     | Yes (`organization_id`) |
| `ai_conversations`    | OpsPilot AI conversation history                                    | Yes (`organization_id`) |
| `ai_messages`         | Threaded messages within AI conversations                           | Yes (`organization_id`) |
| `action_runs`         | Autonomous operations and playbook execution logs                   | Yes (`organization_id`) |
| `audit_logs`          | Compliance and action audit trail                                   | Yes (`organization_id`) |
| `notifications`       | User alerts and operational notifications                           | Yes (`organization_id`) |
| `systems` & `metrics` | Enterprise infrastructure telemetry targets and time-series metrics |           Yes           |

### Migration Commands

```bash
# Run all pending migrations
npm run db:migrate

# Check migration status
npm run db:status

# Rollback the most recently applied migration
npm run db:rollback
```

### Rollback & Recovery Guidance

- Every forward migration `XXX_name.sql` has a companion rollback file `XXX_name.down.sql`.
- In the event of a migration failure during deployment, the runner automatically issues a SQL `ROLLBACK` on the active transaction to preserve data consistency.
- To revert a migration manually in staging or production:
  ```bash
  npm run db:rollback
  ```

---

## 3. Security & Authentication Architecture

1. **Password Hashing**:
   - Uses `bcrypt` with a cost factor of 12 rounds.
2. **Server-Side Session Storage**:
   - Random 256-bit token generated via `crypto.randomBytes(32).toString('base64url')`.
   - Stored in PostgreSQL as a SHA-256 cryptographic hash (`session_token_hash`). Raw token secrets are **never** stored plaintext in the database.
3. **Cookie Security**:
   - Session cookie `opspilot_session`: `HttpOnly: true`, `SameSite: Lax`, `Path: '/'`, `Secure` in production.
4. **CSRF Protection**:
   - State-changing mutations (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated via cookies strictly enforce `x-csrf-token` header validation against the session CSRF secret using constant-time comparison (`crypto.timingSafeEqual`).
5. **Role-Based Access Control (RBAC)**:
   - `Admin`: Full organizational administration, user management (`/api/v1/admin/users`).
   - `Director`: Operational authority, approval signoffs (`/api/v1/approvals/:id/review`).
   - `Manager`: Operations oversight, project creation, task management.
6. **Multi-Tenant Data Isolation**:
   - All business queries are explicitly bound to `req.user.organizationId`.
   - Cross-organization access attempts return `404 NOT_FOUND` to prevent identifier enumeration.
7. **Safe Logging & Sanitization**:
   - Structured JSON logging masks passwords, tokens, API keys, and authorization headers.

---

## 4. Synthetic Demo Credentials

| Organization                | Role     | Email                        | Password       |
| --------------------------- | -------- | ---------------------------- | -------------- |
| **Acme Operations Corp**    | Director | `director@acme.example.com`  | `DemoPass123!` |
| **Acme Operations Corp**    | Manager  | `manager@acme.example.com`   | `DemoPass123!` |
| **Acme Operations Corp**    | Admin    | `admin@acme.example.com`     | `DemoPass123!` |
| **Globex Intelligence Ltd** | Admin    | `admin@globex.example.com`   | `DemoPass123!` |
| **Globex Intelligence Ltd** | Manager  | `manager@globex.example.com` | `DemoPass123!` |

---

## 5. Local Setup & Testing

### Installation & Environment

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Apply database migrations
npm run db:migrate
```

### Running Tests

```bash
# Run all tests across workspaces
npm test

# Run API security, multi-tenant & health tests
npm run test:api

# Run Web tests
npm run test:web
```

### Starting Services

```bash
# Start backend API (port 4000)
npm run dev:api

# Start frontend dashboard (port 3000)
npm run dev:web

# Or run both concurrently
npm run dev
```

---

## 6. OpsPilot AI Business Copilot

### Architecture & Provider Adapter Pattern

The Copilot is engineered with a **backend-only provider adapter pattern** (`apps/api/src/ai/provider.ts`), decoupling core operational business logic from the underlying LLM provider:

- **Pluggable Adapter (`AiProvider`)**:
  - `OpenAiProvider`: Streams or completes function calls against OpenAI or any OpenAI-compatible gateway (`OPENAI_BASE_URL`).
  - `LocalDeterministicProvider`: Zero-dependency, offline-capable fallback engine that parses intent, executes approved tools, and synthesizes grounded answers without requiring external third-party API keys or internet access.
  - `getAiProvider()`: Factory dynamically selecting provider based on `AI_PROVIDER` and available credentials.

### Approved Read-Only Tools

The AI model is **never** permitted to generate or execute arbitrary SQL. All data retrieval runs through a strict whitelist of read-only tools defined in `apps/api/src/ai/tools/definitions.ts` and executed via `apps/api/src/ai/tools/executor.ts`:

1. `get_projects`: Query and filter organization projects by status and search terms.
2. `get_project_details`: Detailed project progress, summary, and associated task list.
3. `get_tasks`: Query tasks filtered by project, status, priority, search term, or overdue SLA.
4. `get_overdue_work`: Pinpoint overdue tasks and overdue collection invoices past SLA.
5. `get_pending_approvals`: List operational workflow requests awaiting executive review.
6. `get_dashboard_metrics`: Executive-level KPI metrics and velocity summary.

### Multi-Tenant Isolation & Anti-Injection Guardrails

- **Strict Organization Scoping**: Every tool executes parameterized SQL binding `WHERE organization_id = $1`. Cross-tenant record lookups return `404` or permission errors.
- **Untrusted Input Defense**: User messages, task descriptions, and retrieved database rows are treated as untrusted data enclosed in delimiters.
- **Injection Pattern Neutralization**: Attempts to override instructions (`"Ignore previous instructions"`, `"DAN mode"`, SQL injection snippets) are intercepted and rejected, triggering a neutral operations policy.
- **Non-Fabrication (Zero Hallucination)**: When no records match an inquiry, the system explicitly reports that no matching records were found within the tenant. It never invents fake project IDs, task names, or metrics.
- **Structured Answers**: Every response returns a structured payload with `answer` text, clickable `sourceRecords`, active `limitations`, and actionable `suggestedActions`.
- **Database History**: Complete conversation history is persisted in `ai_conversations` and `ai_messages` tables with structured JSONB metadata.

### Documented Test Procedure

Run the end-to-end Copilot test suite via Vitest:

```bash
# Run Copilot integration tests specifically
npm run test:api -- src/__tests__/copilot.test.ts

# Run the complete API test suite (65 tests)
npm run test:api

# Run the complete monorepo test suite (67 tests)
npm test
```

#### Test Coverage Verified:

1. **AI Copilot Status Endpoint**: Verifies configured provider and graceful fallback when credentials are not set.
2. **Tenant Isolation**: Confirms Acme users only retrieve Acme data, Globex users only retrieve Globex data, and cross-tenant conversation access returns `404`.
3. **Prompt Injection Resistance**: Validates that DAN mode, system prompt overrides, and SQL injection strings are neutralized.
4. **Tool Argument Validation**: Validates UUID constraints, limits, and rejection of unapproved tools.
5. **Grounded Answers & Non-Fabrication**: Confirms answers cite real database records with source IDs and report "no records found" for non-existent entities without hallucinating.
6. **Conversation Persistence & Cascade Deletion**: Verifies message history storage and cleanup in PostgreSQL.

### Unresolved Limitations

1. **Read-Only Scope**: The Copilot currently only executes read-only inquiry tools. Automated mutations (e.g. creating tasks or reassigning overdue work directly from chat) require confirmation workflows and are slated for the next operational release.
2. **Context Window Length**: Multi-turn conversation context is currently capped at the last 6 messages (`LIMIT 6`) to prevent token window overflow.
3. **Real-Time Streaming**: Responses are delivered as complete structured payloads rather than Server-Sent Events (SSE) token streaming.
4. **Document / Attachment Parsing**: Inquiries are limited to structured PostgreSQL entities (projects, tasks, approvals, collections); external PDF or spreadsheet uploads are not yet supported.
