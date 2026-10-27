export type SystemStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';
export type SystemEnvironment = 'production' | 'staging' | 'development';

export interface System {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: SystemStatus;
  environment: SystemEnvironment;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSystemDTO {
  name: string;
  slug: string;
  description?: string;
  environment: SystemEnvironment;
  status?: SystemStatus;
}
