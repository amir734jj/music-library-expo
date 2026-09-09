import {
  UserRole,
  type AuthenticationResponse,
  type LoginRequest,
  type RegisterRequest,
  type UserResponse,
} from "@music-library/core";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { isObjectLike } from "lodash-es";
import { DataSource, QueryFailedError } from "typeorm";

import type { JwtPayload } from "#contracts";
import { User } from "#entities";

const TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
  ) {}

  async register(request: RegisterRequest): Promise<AuthenticationResponse> {
    const email = normalizeEmail(request.email);
    if (request.password !== request.passwordConfirmation) {
      throw new BadRequestException("Password confirmation does not match");
    }
    if (request.password.length < 8) {
      throw new BadRequestException("Password must contain at least 8 characters");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const user = await this.dataSource.transaction("SERIALIZABLE", async (manager) => {
          const users = manager.getRepository(User);
          if (await users.existsBy({ email })) {
            throw new ConflictException("An account with this email already exists");
          }

          const isFirstUser = (await users.count()) === 0;
          return users.save(
            users.create({
              email,
              passwordHash: await hash(request.password, 12),
              displayName: normalizeDisplayName(request.displayName),
              isActive: true,
              role: isFirstUser ? UserRole.Admin : UserRole.User,
              lastLoginAt: null,
            }),
          );
        });
        return { type: "registration", user: toUserResponse(user) };
      } catch (error) {
        if (isPostgresError(error, "40001") && attempt < 2) continue;
        if (isPostgresError(error, "23505")) {
          throw new ConflictException("An account with this email already exists");
        }
        throw error;
      }
    }
    throw new ConflictException("Registration could not be completed");
  }

  async login(request: LoginRequest): Promise<AuthenticationResponse> {
    const users = this.dataSource.getRepository(User);
    const user = await users
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("user.email = :email", { email: normalizeEmail(request.email) })
      .getOne();

    if (!user || !user.isActive || !(await compare(request.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    user.lastLoginAt = new Date();
    await users.save(user);
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_SECONDS * 1000).toISOString();
    return { type: "login", accessToken, expiresAt, user: toUserResponse(user) };
  }
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: [user.role],
    isActive: user.isActive,
  };
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new BadRequestException("A valid email is required");
  }
  return email;
}

function normalizeDisplayName(value: string | null): string | null {
  const displayName = value?.trim();
  return displayName ? displayName.slice(0, 120) : null;
}

function isPostgresError(error: unknown, code: string): boolean {
  return error instanceof QueryFailedError &&
    isObjectLike(error.driverError) &&
    "code" in error.driverError &&
    error.driverError.code === code;
}