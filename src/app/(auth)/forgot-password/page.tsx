// Phase 4.4 — Forgot password page.
//
// Better Auth's emailAndPassword plugin supports password reset via email
// when `sendResetPassword` is configured in auth.ts. Until that's wired
// to a transactional email provider, this page provides a clear path:
//   1. User enters their email address.
//   2. If the email matches a known account, we display a confirmation.
//   3. Support can then manually send a reset link.
//
// This is intentionally a soft landing — we never reveal whether an email
// exists in the system (prevents account enumeration).

import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Reset password — OneAce",
};

export default function ForgotPasswordPage() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold">Reset your password</h1>
				<p className="text-sm text-muted-foreground">
					Enter your email address and we&apos;ll send you a link to reset your
					password.
				</p>
			</div>

			<ForgotPasswordForm />

			<div className="text-center text-sm text-muted-foreground">
				Remember your password?{" "}
				<Link
					href="/login"
					className="font-medium text-primary hover:underline"
				>
					Sign in
				</Link>
			</div>
		</div>
	);
}
