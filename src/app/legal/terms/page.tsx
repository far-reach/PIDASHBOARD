import type { Metadata } from "next";
import { SupportContact } from "@/components/SupportContact";

export const metadata: Metadata = { title: "Terms of Use · Cyberekt Market" };

export default function TermsPage() {
  return (
    <article className="max-w-2xl pb-4 text-sm leading-relaxed space-y-3">
      <h1 className="text-lg font-semibold">Terms of Use</h1>
      <p className="text-xs text-muted-foreground">
        Draft template. To be reviewed by qualified counsel before App Directory submission.
      </p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>
          <strong>Service.</strong> Cyberekt Market is an informational dashboard for the PIUSDT
          market: prices reported by third-party exchanges, automated daily summaries, a permanent
          archive of those reports, and educational content. The service is provided &quot;as
          is&quot; without warranties of any kind.
        </li>
        <li>
          <strong>No advice, no execution.</strong> The service publishes educational information
          only (see the Risk Disclaimer). It does not execute trades, custody assets, or provide
          personalized recommendations.
        </li>
        <li>
          <strong>Accounts.</strong> Sign-in uses Pi Network identity via the official Pi SDK. You
          are responsible for activity under your Pi account. We may suspend access for abuse
          (automated scraping, attempted manipulation of published records, unlawful use).
        </li>
        <li>
          <strong>Subscriptions.</strong> Where a paid tier is offered, payment is made in Pi via
          the Pi payment flow. Entitlements activate only after the Pi platform confirms the
          transaction. Except where law requires otherwise, subscription periods already started
          are non-refundable.
        </li>
        <li>
          <strong>Integrity of the record.</strong> Published daily reports are append-only. We do
          not edit history, and you agree not to attempt to.
        </li>
        <li>
          <strong>Intellectual property.</strong> App content and code are protected. Exchange
          data belongs to its originating venues and is redistributed for display only.
        </li>
        <li>
          <strong>Liability.</strong> To the maximum extent permitted by law, Cyberekt Market and its
          operator are not liable for trading losses, data inaccuracies, downtime, or any indirect
          or consequential damages arising from use of the service.
        </li>
        <li>
          <strong>Tips.</strong> Tips are voluntary payments in Pi that support the running costs
          of the app. They purchase no product, grant no access, entitle you to no advice, and are
          non-refundable.
        </li>
        <li>
          <strong>Changes.</strong> We may update these terms; continued use after an update is
          acceptance. Material changes will be announced in-app.
        </li>
      </ol>
      <SupportContact />
      <p className="text-xs text-muted-foreground">
        Cyberekt Market is an independent community application and is not affiliated with, endorsed by, or
        sponsored by the Pi Core Team or Pi Network.
      </p>
    </article>
  );
}
