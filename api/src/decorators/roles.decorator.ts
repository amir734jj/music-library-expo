import type { UserRoleType } from "@music-library/core";
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRoleType[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);