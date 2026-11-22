/** The one-line result a form sends back: ?ok= or ?error= in the address. */
export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const error = one(sp.error);
  const ok = one(sp.ok);
  if (error) return <p className="notice notice--error" role="alert">{error}</p>;
  if (ok) return <p className="notice" role="status">{ok}</p>;
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
