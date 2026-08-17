import type { Metadata } from "next";
import { SupportContact } from "@/components/SupportContact";

export const metadata: Metadata = { title: "Privacy Policy — PiPulse" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl pb-4 text-sm leading-relaxed space-y-3">
      <h1 className="text-lg font-semibold">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground">
        Draft template — to be reviewed by qualified counsel before App Directory submission.
      </p>
      <p>
        <strong>What we collect.</strong> Only what the Pi SDK provides when you choose to sign in:
        your Pi user identifier and username. If you subscribe, we store the Pi payment identifier
        and subscription period. That is the complete list.
      </p>
      <p>
        <strong>What we do not collect.</strong> No email addresses, no phone numbers, no wallet
        keys, no exchange API keys, no location, no contacts. We run no third-party analytics, no
        advertising trackers, and no fingerprinting. Server logs are operational (errors, health)
        and are not used to profile users.
      </p>
      <p>
        <strong>Local storage.</strong> The app stores your last-seen market data and your
        risk-banner dismissal on your own device so the app works offline. This data never leaves
        your device.
      </p>
      <p>
        <strong>Sharing.</strong> We share data with no one, except infrastructure providers that
        host the database and application (bound by their own data-processing agreements), and the
        Pi platform itself during authentication and payment, as initiated by you.
      </p>
      <p>
        <strong>Retention & deletion.</strong> Account records are kept while your account is
        active. Contact the operator using the details below to request deletion; anonymized
        aggregate statistics (e.g. subscriber counts) may be retained.
      </p>
      <SupportContact />
      <p>
        <strong>Changes.</strong> Material changes to this policy will be announced in-app before
        they take effect.
      </p>
    </article>
  );
}
