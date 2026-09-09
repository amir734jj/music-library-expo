export const UserRole = {
  Admin: "Admin",
  User: "User",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  roles: UserRole[];
}

export interface UpdateUserRequest {
  displayName: string | null;
  isActive: boolean;
  role: UserRole | null;
}