import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileBookingBar } from "@/components/mobile-booking-bar";
import { isProduction } from "@/content/site";
import { ApertureCursor } from "@/components/aperture-cursor";

/** Public website: preview banner, header, footer and the mobile booking bar. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {isProduction ? null : (
        <div className="border-b border-line bg-canvas px-4 py-2 text-center text-[11px] tracking-[0.04em] text-muted">
          Preview site · photographs are temporary stock images · not yet open for bookings
        </div>
      )}
      <SiteHeader />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
      <MobileBookingBar />
      <ApertureCursor />
    </>
  );
}
