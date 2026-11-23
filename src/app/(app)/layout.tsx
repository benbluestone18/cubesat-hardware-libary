import Link from "next/link";
import { getMe, getProjects } from "@/lib/data";
import { Face } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Motion, NavScroll, Popovers, ThemeToggle } from "@/components/client";
import { PostFab, ProjectPills, Rail } from "@/components/nav";
import { signOut } from "@/app/actions/people";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [me, projects] = await Promise.all([getMe(), getProjects()]);
  const active = projects.filter((p) => p.status !== "done");
  return (
    <div className="app">
      <div className="app-bg mc-ambient" aria-hidden="true" />
      <a className="sr-only" href="#main">Skip to content</a>
      <div className="mc-screen mc-ambient app-scope">
        <Rail admin={me.role === "admin"} />
        <div className="mc-main">
          <header className="mc-top">
            <Link className="mc-brand" href="/">Hardware Library <span>LG CubeSat</span></Link>
            <ProjectPills projects={active} />
            <div className="mc-top__actions">
              <ThemeToggle />
              <Link className="mc-btn mc-btn--primary" href="/updates/new"><Icon name="plus" /> Post update</Link>
              <Face person={me} size={40} />
              <form action={signOut}>
                <button className="mc-icon-btn" type="submit" aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
              </form>
            </div>
          </header>
          <main id="main" className="stack">{children}</main>
        </div>
      </div>
      <PostFab />
      <Motion />
      <Popovers />
      <NavScroll />
    </div>
  );
}
