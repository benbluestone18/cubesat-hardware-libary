/** Mass and power, summed over parts that have a value. */
export type Budget = { mass: number; power: number; withMass: number; withPower: number; parts: number };

export function sumBudget(parts: { mass_g: number | null; power_w: number | null }[]): Budget {
  let mass = 0, power = 0, withMass = 0, withPower = 0;
  for (const p of parts) {
    if (p.mass_g != null) { mass += Number(p.mass_g); withMass++; }
    if (p.power_w != null) { power += Number(p.power_w); withPower++; }
  }
  return { mass, power, withMass, withPower, parts: parts.length };
}

export function grams(g: number | null | undefined): string {
  if (g == null) return "—";
  const n = Number(g);
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 1 : 2)} kg` : `${n % 1 === 0 ? n : n.toFixed(1)} g`;
}

export function watts(w: number | null | undefined): string {
  if (w == null) return "—";
  const n = Number(w);
  return n < 1 && n > 0 ? `${Math.round(n * 1000)} mW` : `${n % 1 === 0 ? n : n.toFixed(2)} W`;
}

/** How full a budget is: "over", "near" (above 90 %) or "ok". */
export function fill(used: number, limit: number | null | undefined): { pct: number; tone: "ok" | "near" | "over" } | null {
  if (!limit) return null;
  const pct = (used / Number(limit)) * 100;
  return { pct, tone: pct > 100 ? "over" : pct > 90 ? "near" : "ok" };
}
