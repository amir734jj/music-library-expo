import type { UserResponse } from "./users.js";

export interface RegisterRequest {
  email: string;
  password: string;
  passwordConfirmation: string;
  displayName: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginAuthenticationResponse {
  type: "login";
  accessToken: string;
  expiresAt: string;
  user: UserResponse;
}

export interface RegistrationAuthenticationResponse {
  type: "registration";
  user: UserResponse;
}

export type AuthenticationResponse =
  | LoginAuthenticationResponse
  | RegistrationAuthenticationResponse;