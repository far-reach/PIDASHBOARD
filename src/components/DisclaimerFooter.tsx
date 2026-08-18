import Link from "next/link";

/**
 * On every screen (brief §3.3). Not dismissible.
 *
 * Structured rather than run as one block of small print: a labelled
 * heading, the disclosure itself, a divider, the legal links laid out on a
 * grid so they line up instead of wrapping raggedly, and the independence
 * statement as a closing line. Source attribution stays inside the
 * disclosure paragraph, where CoinGecko's terms require it to be public
 * (COMPLIANCE.md §3b).
 */
const LINKS = [
  { href: "/legal/risk", label: "Risk disclaimer" },
  { href: "/legal/terms", label: "Terms of use" },
  { href: "/legal/privacy", label: "Privacy policy" },
  { href: "/learn", label: "How to read this data" },
] as const;

export function DisclaimerFooter() {
  return (
    <footer
      className="mt-10 border-t border-border bg-muted/20 px-4 pb-28 pt-6 md:pb-8"
      data-testid="disclaimer-footer"
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="space-y-2">
          <h2 className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/90 before:h-3 before:w-1 before:shrink-0 before:rounded-full before:bg-accent-bar before:content-['']">
            Not financial advice
          </h2>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Crypto markets carry risk of loss; past market behaviour does not indicate future
            results. All content is informational and educational, generated from market data
            published by third parties: CoinGecko, OKX and MEXC. Figures are as reported by those
            sources, never statements of value. This app makes no forecasts, no valuation claims
            and no recommendations. Prices are shown &quot;as of&quot; their stated UTC timestamps
            and differ between exchanges.
          </p>
        </div>

        <nav
          aria-label="Legal and reference"
          className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-border/60 py-3 sm:flex sm:flex-wrap sm:gap-x-6"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          Cyberekt is an independent community app and is not affiliated with or endorsed by the
          Pi Core Team.
        </p>
      </div>
    </footer>
  );
}
