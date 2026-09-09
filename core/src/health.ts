export type HealthStatus =
  | { status: "ok"; database: "up" }
  | { status: "unavailable"; database: "down" };