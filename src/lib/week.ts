/** Weeks start on Monday in the team's time zone. Week numbers follow ISO 8601 ("WK 47"). */
export const TEAM_TZ = "America/Los_Angeles";

/** Today's date in the team's time zone, as YYYY-MM-DD. */
export function todayInTeamTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The Monday on or before a date. */
export function weekStart(date: string = todayInTeamTz()): string {
  const d = parse(date);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return format(d);
}

export function addWeeks(start: string, n: number): string {
  const d = parse(start);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return format(d);
}

/** ISO week number, for "WK 47". */
export function isoWeek(date: string): number {
  const d = parse(date);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

export function weekLabel(start: string): string {
  return `WK ${isoWeek(start)}`;
}

/** "Nov 21" */
export function shortDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso) : iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TEAM_TZ }).format(d);
}

/** "Nov 21, 3:05 PM", in the team's time zone. */
export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TEAM_TZ }).format(new Date(iso));
}

/** Whole days between a timestamp and now. */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000));
}

/** "Today", "2d ago" */
export function ago(iso: string | null | undefined, now: Date = new Date()): string {
  const d = daysSince(iso, now);
  if (d === null) return "Never";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return format(d);
}

/** "Nov 17 to 23" */
export function weekRange(start: string): string {
  const end = addDays(start, 6);
  const a = shortDate(start);
  const b = shortDate(end);
  return a.split(" ")[0] === b.split(" ")[0] ? `${a} to ${b.split(" ")[1]}` : `${a} to ${b}`;
}
