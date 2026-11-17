import Link from "next/link";
import { serviceList } from "@/content/services";

export default function NotFound() {
  return (
    <section className="wrap flex flex-col gap-6 pb-32 pt-28">
      <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]">This page isn&apos;t here.</h1>
      <p className="text-lg">The link may be old or mistyped.</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[17px]">
        {serviceList.map((s) => <li key={s.slug}><Link href={s.path}>{s.name}</Link></li>)}
        <li><Link href="/">Home</Link></li>
      </ul>
    </section>
  );
}
