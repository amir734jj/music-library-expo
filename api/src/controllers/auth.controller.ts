import type {
  AuthenticationResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from "@music-library/core";
import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { User } from "#entities";
import { JwtAuthGuard } from "#guards";
import { AuthService, toUserResponse } from "#services";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() request: RegisterRequest): Promise<AuthenticationResponse> {
    return this.auth.register(request);
  }

  @Post("login")
  login(@Body() request: LoginRequest): Promise<AuthenticationResponse> {
    return this.auth.login(request);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request & { user: User }): UserResponse {
    return toUserResponse(request.user);
  }
}