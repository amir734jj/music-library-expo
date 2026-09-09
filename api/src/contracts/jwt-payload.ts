import type { UserRoleType } from "@music-library/core";

export interface JwtPayload {
  sub: string;
  role: UserRoleType;
}