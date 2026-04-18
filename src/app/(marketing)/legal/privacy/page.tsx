// God-Mode v2 §1.3 — public Privacy Policy page.
//
// Linked from the register form's trust footer and referenced by the
// Terms of Service page. Before this page existed, the link 404'd,
// which both broke user trust and is inconsistent with the GDPR /
// privacy posture the app claims (OneAce already ships a user-delete
// cascade in production — see v1.1.0-rc3).
//
// Copy below is a plain-English starter privacy notice suitable for
// a private beta with US + EU users. Like the Terms, it must be
// reviewed by counsel before the app opens to public registration.
// Key factual statements below are kept intentionally conservative
// and match what the code actually does:
//   - transactional email goes through Resend when configured
//   - analytics via PostHog is optional and gated by env vars
//   - error monitoring via Sentry is optional and gated by env vars
//   - account deletion cascades inventory data in the same DB
//     transaction (see `src/lib/gdpr-user-delete.ts`)
//
// The page lives under the `(marketing)` route group so it inherits
// the public nav + footer shell.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — OneAce",
  description:
    "How OneAce collects, uses, and protects personal data when you use the OneAce inventory platform.",
};

const LAST_UPDATED = "April 18, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <article className="prose prose-slate max-w-none">
        <header className="not-prose mb-10">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="space-y-5 text-sm leading-6 text-foreground">
          <p>
            This Privacy Policy explains what information OneAce (&quot;OneAce&quot;,
            &quot;we&quot;) collects when you use the OneAce inventory platform
            (&quot;Service&quot;), how we use it, and the choices you have. It works alongside our{" "}
            <Link href="/legal/terms" className="font-medium underline">
              Terms of Service
            </Link>
            .
          </p>

          <h2 className="mt-8 text-lg font-semibold">1. Information We Collect</h2>
          <p>
            <strong>Account data.</strong> When you sign up we collect your name, email address,
            organization name, and a hashed password. If you accept an invitation we also record the
            inviting user and role.
          </p>
          <p>
            <strong>Inventory data.</strong> All content you create or upload to the Service —
            items, warehouses, stock counts, purchase orders, files — is stored under your
            Organization and scoped by Organization id so other tenants cannot access it.
          </p>
          <p>
            <strong>Usage data.</strong> We log request metadata (IP address, user agent, timestamp,
            status code, endpoint) needed to operate the Service, detect abuse, and diagnose errors.
            Product analytics (PostHog) is <em>only</em> collected when the relevant environment
            variable is configured by the operator.
          </p>
          <p>
            <strong>Error reports.</strong> Unhandled exceptions and performance traces may be sent
            to Sentry when enabled by the operator, for debugging. Error reports may include the URL
            path and a sanitised stack trace.
          </p>

          <h2 className="mt-8 text-lg font-semibold">2. How We Use Information</h2>
          <p>
            We use information to provide and secure the Service, process transactions, send
            transactional email (account verification, password reset, invitations, billing
            receipts), prevent abuse, and improve reliability. We do not sell personal data. We do
            not use your Inventory Data to train external models.
          </p>

          <h2 className="mt-8 text-lg font-semibold">3. Sharing With Sub-Processors</h2>
          <p>
            We rely on a small set of sub-processors to run the Service. Each is bound by data
            protection agreements and processes only the data necessary for its role:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Database hosting</strong> — Neon / Vercel Postgres (US or EU region, per
              deployment).
            </li>
            <li>
              <strong>Application hosting</strong> — Vercel.
            </li>
            <li>
              <strong>Payments</strong> — Stripe (for customers on paid plans).
            </li>
            <li>
              <strong>Transactional email</strong> — Resend (when configured).
            </li>
            <li>
              <strong>Product analytics</strong> — PostHog (optional, configured by operator).
            </li>
            <li>
              <strong>Error monitoring</strong> — Sentry (optional, configured by operator).
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold">4. Data Retention and Deletion</h2>
          <p>
            Customer Data is retained while your account is active. Closing your account triggers a
            cascade delete that removes your personal data and your Organization&apos;s Inventory
            Data from our operational database. Backups are rotated on a rolling 30-day window and
            then purged. You can request an export before closing your account.
          </p>

          <h2 className="mt-8 text-lg font-semibold">5. Your Rights</h2>
          <p>
            Depending on your jurisdiction you may have the right to access, correct, export, or
            delete your personal data, and to object to or restrict certain processing. You can
            exercise these rights from the account settings page or by contacting{" "}
            <a href="mailto:hello@oneace.app" className="font-medium underline">
              hello@oneace.app
            </a>
            . We will respond within 30 days.
          </p>

          <h2 className="mt-8 text-lg font-semibold">6. Security</h2>
          <p>
            Data is encrypted in transit (TLS 1.2+) and at rest in our managed database. Passwords
            are stored as salted hashes. Sensitive routes are protected by rate limiting, and
            per-tenant isolation is enforced at the query layer. We follow a principle-of-least-
            privilege access model for operator access to production.
          </p>

          <h2 className="mt-8 text-lg font-semibold">7. International Transfers</h2>
          <p>
            If you are located outside the region where your organization&apos;s data is hosted,
            transferring data to OneAce involves an international transfer. We rely on appropriate
            safeguards (standard contractual clauses) for such transfers.
          </p>

          <h2 className="mt-8 text-lg font-semibold">8. Changes to This Policy</h2>
          <p>
            We may update this policy over time. Material changes will be communicated by email or
            in-product notice before they take effect. The &quot;Last updated&quot; date at the top
            of this page always reflects the current version.
          </p>

          <h2 className="mt-8 text-lg font-semibold">9. Contact</h2>
          <p>
            Questions about this Privacy Policy or our data practices can be directed to{" "}
            <a href="mailto:hello@oneace.app" className="font-medium underline">
              hello@oneace.app
            </a>
            .
          </p>
        </section>

        <footer className="not-prose mt-16 border-t pt-6 text-sm text-muted-foreground">
          <p>
            See also:{" "}
            <Link href="/legal/terms" className="font-medium text-primary underline">
              Terms of Service
            </Link>
            .
          </p>
        </footer>
      </article>
    </div>
  );
}
