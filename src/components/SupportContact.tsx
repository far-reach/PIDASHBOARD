/**
 * The operator's contact address.
 *
 * The privacy policy promises a way to reach the operator (deletion requests),
 * and app-directory reviewers look for one. It is configured rather than
 * hardcoded so the operator picks the channel they actually monitor; a Pi
 * username, an email, a chat handle; without editing code.
 *
 * Note the direction of travel: this publishes OUR address to users. It never
 * collects theirs, which §3.10 forbids.
 */

export function supportContact(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_CONTACT?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function SupportContact({ className }: { className?: string }) {
  const contact = supportContact();
  return (
    <p className={className ?? "text-sm"}>
      <strong>Support & contact.</strong>{" "}
      {contact ? (
        <>
          Reach the operator at <span className="font-medium">{contact}</span>. We aim to reply
          within a few days.
        </>
      ) : (
        <>
          Reach the operator through the contact details published on this app&apos;s listing in
          the Pi Developer Portal.
        </>
      )}
    </p>
  );
}
