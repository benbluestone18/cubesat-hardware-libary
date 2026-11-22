"use client";
import { Empty } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <Empty action={<button className="mc-btn mc-btn--primary mc-btn--sm" type="button" onClick={reset}>Try again</button>}>Something broke loading this page. If it keeps happening, tell the admin what you clicked.</Empty>;
}
