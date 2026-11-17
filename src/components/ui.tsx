import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { isProduction } from "@/content/site";

const base =
  "inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[2px] border px-7 text-[12px] font-medium uppercase tracking-[0.18em] no-underline transition-colors duration-300";

const variants = {
  /** Solid ivory: the main action on a page. */
  primary: "border-transparent bg-ivory text-canvas hover:bg-white hover:text-canvas",
  /** Hairline outline. */
  secondary: "border-field bg-transparent text-ivory hover:border-ivory hover:bg-ivory hover:text-canvas",
  /** Bronze, for the closing call to action. */
  accent: "border-transparent bg-bronze text-canvas hover:bg-[#b99a72] hover:text-canvas",
  /** Over photographs. */
  onPhoto: "border-ivory/70 bg-canvas/20 text-ivory backdrop-blur-sm hover:border-ivory hover:bg-ivory hover:text-canvas",
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

/** Underlined text link, used for secondary actions. */
export function TextLink({ className = "", ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={`text-ivory underline decoration-line-strong hover:text-bronze hover:decoration-bronze ${className}`} />;
}

/** Small uppercase link with an arrow: "View the work →". */
export function ArrowLink({ className = "", children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={`group inline-flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.2em] text-ivory no-underline hover:text-bronze ${className}`}
    >
      <span>{children}</span>
      <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
    </Link>
  );
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
  const cls = "border border-dashed border-bronze bg-raised px-2 py-0.5 text-fg-soft";
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
  title: ReactNode;
  intro?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {label ? <p className="label-rule">{label}</p> : null}
      <Tag className={Tag === "h1" ? "text-[clamp(3rem,6.5vw,5.75rem)] leading-[1.02]" : "text-[clamp(2.25rem,4.2vw,3.5rem)] leading-[1.06]"}>
        {title}
      </Tag>
      {intro ? <div className="max-w-[60ch] text-[1.0625rem] leading-relaxed text-fg-soft">{intro}</div> : null}
    </div>
  );
}
