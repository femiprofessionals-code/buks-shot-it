export const field = "h-11 w-full rounded-[2px] border border-[#cfc6b7] bg-white px-3 text-[15px] focus:border-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal";
export const primary = "inline-flex h-11 items-center justify-center rounded-[2px] bg-charcoal px-5 text-[13px] font-medium uppercase tracking-[0.12em] text-ivory hover:bg-[#2e2c29] disabled:opacity-60";
export const secondary = "inline-flex h-9 items-center justify-center rounded-[2px] border border-[#cfc6b7] bg-white px-3 text-[13px] text-charcoal hover:border-charcoal disabled:opacity-50";
export const categoryLabels = { wedding: "Weddings", portrait: "Portraits", event: "Events", product: "Products" } as const;
export type Category = keyof typeof categoryLabels;
