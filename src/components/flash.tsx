import { FlashNotice } from "./client";

/** The one-line result a form sends back: ?ok= or ?error= in the address. */
export function Flash({ sp, place = "top" }: { sp: Record<string, string | string[] | undefined>; place?: string }) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // A message meant for a panel (?in=links) shows only there; the rest show at the top.
  if ((one(sp.in) ?? "top") !== place) return null;
  const error = one(sp.error);
  const ok = one(sp.ok);
  if (error) return <FlashNotice kind="error" text={error} />;
  if (ok) return <FlashNotice kind="ok" text={ok} />;
  return null;
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function PageTitle({ eyebrow, title, sub, children }: { eyebrow?: React.ReactNode; title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="crumbs">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}
