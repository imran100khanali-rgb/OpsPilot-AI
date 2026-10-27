export type UserRole = 'Director' | 'Manager' | 'Admin';

export interface User {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
  organization: Organization;
  expiresAt: string;
}

export interface LoginResponse {
  user: User;
  organization: Organization;
  csrfToken: string;
}
