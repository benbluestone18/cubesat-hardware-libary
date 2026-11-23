import type { Metadata } from "next";
import Link from "next/link";
import { getLibrary } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Week } from "@/lib/types";
import { addWeeks, weekLabel, weekRange, weekStart } from "@/lib/week";
import { Icon } from "@/components/icons";
import { PageTitle } from "@/components/flash";

export const metadata: Metadata = { title: "Weekly meetings" };

export default async function Weeks() {
  const lib = await getLibrary();
  const supabase = await createClient();
  const now = weekStart();
  const from = addWeeks(now, -15);
  const [{ data: weeks }, { data: ups }] = await Promise.all([
    supabase.from("weeks").select("*").gte("week_start", from),
    supabase.from("updates").select("week_start, component_id, blocked").gte("week_start", from),
  ]);
  const W = new Map(((weeks ?? []) as Week[]).map((w) => [w.week_start, w]));
  const live = new Set(lib.components.map((c) => c.id));
  // Only weeks with something in them, plus this week, so there are no empty rows before anyone posted.
  const used = new Set([...W.keys(), ...(ups ?? []).filter((u) => live.has(u.component_id)).map((u) => u.week_start as string)]);
  const list = Array.from({ length: 16 }, (_, i) => addWeeks(now, -i)).filter((w) => w === now || used.has(w));
  return (
    <>
      <PageTitle title="Weekly meetings" sub="One page per week: the slides link and every update posted that week, grouped by project." />
      <section className="mc-panel mc-glass">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Week</th><th>Dates</th><th>Updates</th><th>Blocked</th><th>Slides</th></tr></thead>
            <tbody>
              {list.map((w) => {
                const these = (ups ?? []).filter((u) => u.week_start === w && live.has(u.component_id));
                const blocked = these.filter((u) => (u.blocked as string).trim()).length;
                const slides = W.get(w)?.slides_url;
                return (
                  <tr key={w}>
                    <td><Link className="link" href={`/weeks/${w}`}>{weekLabel(w)}</Link>{w === now && <span className="mc-chip" style={{ marginLeft: 8 }}>This week</span>}</td>
                    <td className="muted">{weekRange(w)}</td>
                    <td className="mc-data">{these.length}</td>
                    <td>{blocked ? <span className="state state--stalled">{blocked}</span> : <span className="faint">0</span>}</td>
                    <td>{slides ? <a className="link row" style={{ gap: 4 }} href={slides} target="_blank" rel="noreferrer"><Icon name="external" size={12} />Slides</a> : <span className="faint">None</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
