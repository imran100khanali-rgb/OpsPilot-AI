export interface MetricDataPoint {
  id: string;
  systemId: string;
  metricName: string;
  value: number;
  unit: string;
  recordedAt: string;
}

export interface SystemMetricSummary {
  systemId: string;
  systemName: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  latencyP99Ms: number;
  errorRatePercent: number;
  activeIncidents: number;
}
