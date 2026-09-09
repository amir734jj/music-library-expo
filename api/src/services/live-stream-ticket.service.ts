import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

interface TicketEntry {
  stationId: string;
  expiresAt: number;
}

const TICKET_LIFETIME_MS = 60_000;

@Injectable()
export class LiveStreamTicketService {
  private readonly tickets = new Map<string, TicketEntry>();

  issue(stationId: string): string {
    this.removeExpired();
    const ticket = randomBytes(32).toString("base64url");
    this.tickets.set(ticket, {
      stationId,
      expiresAt: Date.now() + TICKET_LIFETIME_MS,
    });
    return ticket;
  }

  resolve(ticket: string): string | null {
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.tickets.delete(ticket);
      return null;
    }
    return entry.stationId;
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.tickets) {
      if (entry.expiresAt <= now) this.tickets.delete(ticket);
    }
  }
}