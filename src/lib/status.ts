/**
 * Stall rules (from the design system):
 * - A component goes quiet after 7 days without an update and stalls after 14,
 *   or at once when its latest update lists a blocker.
 * - A person goes quiet or stalls by the same days, counted from their latest update on any component.
 * - A project shows the worst state among its active components.
 */
import { daysSince } from "./week";

export const QUIET_DAYS = 7;
export const STALL_DAYS = 14;

export type ComponentStatus = "planned" | "in_design" | "in_review" | "released" | "built" | "on_hold";
export type Health = "done" | "working" | "warn" | "stalled" | "planned";

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  planned: "Planned",
  in_design: "In design",
  in_review: "In review",
  released: "Released",
  built: "Built",
  on_hold: "On hold",
};

export const STATUS_ORDER: ComponentStatus[] = ["planned", "in_design", "in_review", "released", "built", "on_hold"];

/** Steps on the lifecycle track. On hold keeps its place but is shown amber. */
export const STATUS_STEP: Record<ComponentStatus, number> = {
  planned: 1, in_design: 2, in_review: 3, released: 4, built: 5, on_hold: 0,
};

export const HEALTH_LABEL: Record<Health, string> = {
  done: "On track",
  working: "Working",
  warn: "Going quiet",
  stalled: "Stalled",
  planned: "Planned",
};

const RANK: Record<Health, number> = { stalled: 4, warn: 3, working: 2, planned: 1, done: 0 };

export interface ComponentHealthInput {
  status: ComponentStatus;
  last_update_at: string | null;
  created_at: string;
  latest_blocked?: string | null;
}

export interface HealthResult {
  health: Health;
  days: number;
  reason: string;
}

export function componentHealth(c: ComponentHealthInput, now: Date = new Date()): HealthResult {
  const days = daysSince(c.last_update_at ?? c.created_at, now) ?? 0;
  if (c.status === "released" || c.status === "built") return { health: "done", days, reason: STATUS_LABEL[c.status] };
  if (c.status === "on_hold") return { health: "warn", days, reason: "On hold" };
  if (c.latest_blocked && c.latest_blocked.trim()) return { health: "stalled", days, reason: "Blocked" };
  if (c.status === "planned" && !c.last_update_at) return { health: "planned", days, reason: "Not started" };
  if (days >= STALL_DAYS) return { health: "stalled", days, reason: `No update for ${days}d` };
  if (days >= QUIET_DAYS) return { health: "warn", days, reason: `No update for ${days}d` };
  return { health: "working", days, reason: STATUS_LABEL[c.status] };
}

/** A person's freshness, from their latest update on any component. Null when they own nothing active. */
export function personHealth(latestUpdateAt: string | null, activeComponents: number, joinedAt: string, now: Date = new Date()): HealthResult | null {
  if (activeComponents === 0) return null;
  const days = daysSince(latestUpdateAt ?? joinedAt, now) ?? 0;
  if (days >= STALL_DAYS) return { health: "stalled", days, reason: latestUpdateAt ? `No update for ${days}d` : "No updates yet" };
  if (days >= QUIET_DAYS) return { health: "warn", days, reason: latestUpdateAt ? `No update for ${days}d` : "No updates yet" };
  return { health: "done", days, reason: "On track" };
}

export function worst(healths: Health[]): Health {
  return healths.reduce<Health>((w, h) => (RANK[h] > RANK[w] ? h : w), "done");
}

export function byUrgency<T extends { health: HealthResult }>(a: T, b: T): number {
  return RANK[b.health.health] - RANK[a.health.health] || b.health.days - a.health.days;
}
