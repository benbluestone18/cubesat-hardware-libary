/** @mentions are written as "@Full Name" (the box fills that in). Matching is case-insensitive. */
type Named = { id: string; name: string };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A pattern that finds "@Name" for anyone on the team, longest names first so "@Sam Okafor" beats "@Sam". */
export function mentionPattern(people: Named[]): RegExp | null {
  const names = people.map((p) => p.name.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return null;
  return new RegExp(`@(${names.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "giu");
}

/** Everyone a comment mentions, by id. */
export function findMentions(body: string, people: Named[]): string[] {
  const re = mentionPattern(people);
  if (!re) return [];
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const ids = new Set<string>();
  for (const m of body.matchAll(re)) {
    const id = byName.get(m[1].toLowerCase());
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Splits a comment into text and mentions, for display. */
export function splitMentions(body: string, people: Named[]): ({ text: string } | { person: Named; text: string })[] {
  const re = mentionPattern(people);
  if (!re) return [{ text: body }];
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p]));
  const out: ({ text: string } | { person: Named; text: string })[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    const person = byName.get(m[1].toLowerCase());
    if (!person) continue;
    if (m.index > last) out.push({ text: body.slice(last, m.index) });
    out.push({ person, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last) });
  return out;
}
