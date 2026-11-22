import Link from "next/link";
import { Empty } from "@/components/ui";

export default function NotFound() {
  return <><h1 className="sr-only">Not found</h1><Empty action={<Link className="mc-btn mc-btn--primary mc-btn--sm" href="/">Back to the feed</Link>}>That page doesn&apos;t exist, or it was moved to the trash.</Empty></>;
}
