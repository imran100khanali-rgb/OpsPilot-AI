export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved';

export interface Incident {
  id: string;
  systemId: string;
  systemName?: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  aiSummary?: string;
  detectedAt: string;
  resolvedAt?: string | null;
}
