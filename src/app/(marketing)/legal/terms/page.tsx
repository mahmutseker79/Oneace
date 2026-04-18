// God-Mode v2 §1.3 — public Terms of Service page.
//
// Linked from the register form's trust footer (the `/legal/terms`
// anchor in `register-form.tsx`). Before this page existed, that
// link 404'd — which is both a user-trust red flag and a legal
// consideration (most jurisdictions require terms to be accessible
// before account creation).
//
// Copy below is a plain-English starter template suitable for a
// private beta. It intentionally uses neutral defaults ("the
// Service", generic dispute-resolution clauses, no jurisdiction-
// specific add-ons). Legal review is required before opening
// registration to the public — tracked in the `README`'s compliance
// checklist.
//
// The page lives under the `(marketing)` route group so it inherits
// the same public nav + footer as `/pricing` and `/docs`.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — OneAce",
  description:
    "OneAce Terms of Service — the agreement governing use of the OneAce inventory platform.",
  // robots: allow indexing. Legal pages are content.
};

const LAST_UPDATED = "April 18, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <article className="prose prose-slate max-w-none">
        <header className="not-prose mb-10">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="space-y-5 text-sm leading-6 text-foreground">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the OneAce
            inventory management platform (&quot;Service&quot;), operated by OneAce
            (&quot;OneAce&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account, accepting
            an invitation, or otherwise using the Service, you agree to be bound by these Terms.
          </p>

          <h2 className="mt-8 text-lg font-semibold">1. Accounts and Organizations</h2>
          <p>
            You must provide accurate information when creating an account and keep it up to date.
            You are responsible for maintaining the security of your credentials and for all
            activity that occurs under your account. Each account belongs to an Organization;
            administrators of that Organization may invite, remove, or change the permissions of
            other members.
          </p>

          <h2 className="mt-8 text-lg font-semibold">2. Acceptable Use</h2>
          <p>
            You may not use the Service to store, transmit, or process content that is unlawful,
            infringes on the rights of others, contains malicious code, or interferes with the
            operation of the Service. We may suspend accounts that violate this section.
          </p>

          <h2 className="mt-8 text-lg font-semibold">3. Your Data</h2>
          <p>
            You retain ownership of all data you upload or create within the Service
            (&quot;Customer Data&quot;). You grant OneAce a limited license to host, process, and
            display Customer Data solely to provide the Service to your Organization. Handling of
            personal data is described in our{" "}
            <Link href="/legal/privacy" className="font-medium underline">
              Privacy Policy
            </Link>
            .
          </p>

          <h2 className="mt-8 text-lg font-semibold">4. Subscriptions and Billing</h2>
          <p>
            Paid plans are billed through Stripe on the cadence displayed at checkout (monthly or
            annual). Fees are non-refundable except where required by law. You may cancel at any
            time; cancellation takes effect at the end of the current billing period. Price changes
            will be communicated at least 30 days in advance of renewal.
          </p>

          <h2 className="mt-8 text-lg font-semibold">5. Availability and Service Changes</h2>
          <p>
            We work to keep the Service available but do not guarantee uninterrupted access. We may
            add, modify, or remove features to improve the Service; material reductions in
            functionality for paid plans will be announced in advance where practicable.
          </p>

          <h2 className="mt-8 text-lg font-semibold">6. Termination</h2>
          <p>
            You may close your account at any time from the settings panel. We may suspend or
            terminate an account that materially breaches these Terms, with reasonable notice where
            practicable. On termination we will retain Customer Data for a limited export window
            described in the Privacy Policy.
          </p>

          <h2 className="mt-8 text-lg font-semibold">7. Disclaimer and Limitation of Liability</h2>
          <p>
            The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To
            the maximum extent permitted by law, OneAce disclaims all implied warranties and shall
            not be liable for indirect, incidental, or consequential damages arising from use of
            the Service. Our aggregate liability is limited to the fees you paid for the Service in
            the twelve months preceding the event giving rise to the claim.
          </p>

          <h2 className="mt-8 text-lg font-semibold">8. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be communicated by
            email or in-product notice before they take effect. Continued use of the Service after
            the effective date constitutes acceptance.
          </p>

          <h2 className="mt-8 text-lg font-semibold">9. Contact</h2>
          <p>
            Questions about these Terms can be directed to{" "}
            <a href="mailto:hello@oneace.app" className="font-medium underline">
              hello@oneace.app
            </a>
            .
          </p>
        </section>

        <footer className="not-prose mt-16 border-t pt-6 text-sm text-muted-foreground">
          <p>
            See also:{" "}
            <Link href="/legal/privacy" className="font-medium text-primary underline">
              Privacy Policy
            </Link>
            .
          </p>
        </footer>
      </article>
    </div>
  );
}
