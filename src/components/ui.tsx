import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { isProduction } from "@/content/site";

const base =
  "inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[2px] border px-6 text-[13px] font-medium uppercase tracking-[0.12em] no-underline transition-colors duration-200";

const variants = {
  primary: "border-transparent bg-charcoal text-ivory hover:bg-[#2e2c29] hover:text-ivory",
  secondary: "border-charcoal bg-transparent text-charcoal hover:bg-charcoal hover:text-ivory",
  accent: "border-transparent bg-bronze text-charcoal hover:bg-[#b89a73] hover:text-charcoal",
  onDark: "border-transparent bg-ivory text-charcoal hover:bg-white hover:text-charcoal",
  ghostDark: "border-ash bg-transparent text-ivory hover:border-ivory hover:text-ivory",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}

/** Underlined text link in charcoal, used for secondary actions. */
export function TextLink({ className = "", ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={`text-charcoal underline hover:text-bronze-deep ${className}`} />;
}

/**
 * Marks information only the client can supply. Visible in preview builds;
 * a production build fails if any placeholder is still rendered, so the site
 * can never launch with one in place.
 */
export function Placeholder({ children, block = false }: { children: ReactNode; block?: boolean }) {
  if (isProduction) {
    throw new Error(`Placeholder still present in production build: ${String(children)}`);
  }
  const cls = "border border-dashed border-bronze bg-linen px-2 py-0.5 text-ink-soft";
  return block ? (
    <span className={`block ${cls} p-4`}>[Placeholder: {children}]</span>
  ) : (
    <span className={cls}>[Placeholder: {children}]</span>
  );
}

export function SectionHeading({
  label,
  title,
  intro,
  as: Tag = "h2",
}: {
  label?: string;
  title: string;
  intro?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {label ? <p className="label">{label}</p> : null}
      <Tag className={Tag === "h1" ? "text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]" : "text-[clamp(2rem,3.4vw,2.75rem)] leading-[1.1]"}>
        {title}
      </Tag>
      {intro ? <div className="text-[1.0625rem] leading-relaxed text-ink-soft">{intro}</div> : null}
    </div>
  );
}
