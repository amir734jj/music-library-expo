export type ClientLogLevel = "error" | "info" | "warn";

export interface ClientLogRequest {
  context?: string;
  level: ClientLogLevel;
  message: string;
  platform: string;
  stack?: string;
  timestamp: string;
  version?: string;
}