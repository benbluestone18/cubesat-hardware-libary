import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, getLibrary, getMemberships } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { weekLabel, weekRange, weekStart } from "@/lib/week";
import type { Update } from "@/lib/types";
import { postUpdate } from "@/app/actions/updates";
import { Empty } from "@/components/ui";
import { Flash, PageTitle, one, type SP } from "@/components/flash";

export const metadata: Metadata = { title: "Post update" };

export default async function NewUpdate({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [lib, memberships] = await Promise.all([getLibrary(), getMemberships()]);
  const supabase = await createClient();
  const { data: ed } = await supabase.from("component_editors").select("component_id").eq("person_id", lib.me.id);
  const editable = new Set((ed ?? []).map((e) => e.component_id as string));
  const mine = lib.components.filter((c) => canEdit(lib.me, c, editable.has(c.id) ? [lib.me.id] : [], memberships));
  // Your own parts first, then the ones you help on.
  mine.sort((a, b) => Number(b.owner_id === lib.me.id) - Number(a.owner_id === lib.me.id) || a.name.localeCompare(b.name));
  const week = weekStart();
  const chosen = one(sp.component) ?? (mine.length === 1 ? mine[0].id : "");
  const comp = mine.find((c) => c.id === chosen);
  let existing: Update | null = null;
  if (comp) {
    const { data } = await supabase.from("updates").select("*").eq("component_id", comp.id).eq("week_start", week).maybeSingle();
    existing = data as Update | null;
  }

  if (mine.length === 0) {
    return <><PageTitle title="Post update" /><Empty action={<Link className="mc-btn mc-btn--primary mc-btn--sm" href="/components/new">Add a component</Link>}>You don&apos;t own or edit any components yet. Updates are posted per part.</Empty></>;
  }

  return (
    <>
      <PageTitle eyebrow={<><span>{weekLabel(week)}</span><span>·</span><span>{weekRange(week)}</span></>} title="Post update" sub="Three lines per part. Posting again this week replaces this week's update." />
      <Flash sp={sp} />
      {!comp ? (
        <form method="get" className="form mc-panel mc-glass">
          <label className="field"><span>Which part?</span>
            <select className="select" name="component" required defaultValue="">
              <option value="" disabled>Pick a part</option>
              {mine.map((c) => <option key={c.id} value={c.id}>{c.name} · {lib.path(c)}</option>)}
            </select>
          </label>
          <div className="form-actions"><button className="mc-btn mc-btn--primary" type="submit">Next</button></div>
        </form>
      ) : (
        <form action={postUpdate} className="form mc-panel mc-glass">
          <input type="hidden" name="component_id" value={comp.id} />
          <div className="spread">
            <div><b>{comp.name}</b><div className="faint" style={{ fontSize: 13 }}>{lib.path(comp)}</div></div>
            {mine.length > 1 && <Link className="mc-btn mc-btn--ghost mc-btn--sm" href="/updates/new">Change part</Link>}
          </div>
          {existing && <p className="notice">You already posted for this week. Saving replaces it.</p>}
          <label className="field"><span>Done</span><textarea className="textarea" name="done" maxLength={1000} defaultValue={existing?.done} placeholder="What you finished this week" /></label>
          <label className="field"><span>Next</span><textarea className="textarea" name="next" maxLength={1000} defaultValue={existing?.next} placeholder="What you'll do next week" /></label>
          <label className="field"><span>Blocked</span><textarea className="textarea" name="blocked" maxLength={1000} defaultValue={existing?.blocked} placeholder="Leave empty if nothing is in the way" />
            <small>Anything here flags the part red on the feed until the next update clears it.</small>
          </label>
          <div className="form-actions"><button className="mc-btn mc-btn--primary" type="submit">{existing ? "Replace update" : "Post update"}</button></div>
        </form>
      )}
    </>
  );
}
