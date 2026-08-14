import Link from "next/link";

/** On every screen (brief §3.3). Not dismissible. */
export function DisclaimerFooter() {
  return (
    <footer className="border-t border-border mt-8 px-4 py-5 pb-24 md:pb-6" data-testid="disclaimer-footer">
      <p className="text-[11px] leading-relaxed text-muted-foreground max-w-2xl">
        <strong className="text-foreground/80">Not financial advice.</strong> Trading involves risk
        of loss; past performance does not indicate future results. All content is educational
        information generated from market data and our model&apos;s analysis. Signals are published
        with immutable history — including every losing one. Prices shown &quot;as of&quot; their
        stated UTC timestamps and may differ between exchanges. PiPulse is an independent community
        app and is not affiliated with or endorsed by the Pi Core Team.
      </p>
      <nav className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground">
        <Link href="/legal/risk" className="hover:text-foreground underline underline-offset-2">
          Risk disclaimer
        </Link>
        <Link href="/legal/terms" className="hover:text-foreground underline underline-offset-2">
          Terms of use
        </Link>
        <Link href="/legal/privacy" className="hover:text-foreground underline underline-offset-2">
          Privacy policy
        </Link>
        <Link href="/learn" className="hover:text-foreground underline underline-offset-2">
          How to read our signals
        </Link>
      </nav>
    </footer>
  );
}
