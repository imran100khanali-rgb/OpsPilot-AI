export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface MemoryHealth {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  environment: string;
  components: {
    database: ComponentHealth;
    memory: MemoryHealth;
  };
}

export interface ProbeResult {
  status: 'ok' | 'down';
  timestamp: string;
}
