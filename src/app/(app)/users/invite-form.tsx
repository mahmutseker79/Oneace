"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import { inviteMemberAction } from "./actions";

// Phase 2 UX — role descriptions shown in the invite dropdown so
// admins know what each role can do without looking at documentation.
const ROLE_DESCRIPTIONS: Record<string, string> = {
	OWNER: "Full access including billing and org deletion",
	ADMIN: "Can manage members, warehouses, items, and settings",
	MANAGER: "Can create and manage inventory operations",
	MEMBER: "Can record movements and stock counts",
	VIEWER: "Read-only access to all data",
};

export type InviteFormLabels = {
	emailLabel: string;
	emailPlaceholder: string;
	roleLabel: string;
	submit: string;
	/** Shown when the invitation row was created AND the email was delivered. */
	successEmailSent: string;
	/** Shown when the row was created but email delivery failed or is disabled. */
	successLinkOnly: string;
	linkHeading: string;
	/** Uses `{email}` and `{expires}` placeholders. */
	linkHelp: string;
	copy: string;
	copied: string;
	roleOptions: Array<{ value: string; label: string }>;
};

type InviteFormProps = {
	labels: InviteFormLabels;
	defaultRole: string;
	/** Locale string used to format the expiresAt timestamp on the client. */
	locale: string;
};

type InviteCreated = {
	email: string;
	url: string;
	expiresAt: Date;
	emailDelivered: boolean;
};

export function InviteForm({ labels, defaultRole, locale }: InviteFormProps) {
	const [isPending, startTransition] = useTransition();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<string>(defaultRole);
	const [error, setError] = useState<string | null>(null);
	const [created, setCreated] = useState<InviteCreated | null>(null);
	const [copied, setCopied] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setFieldErrors({});
		setCreated(null);
		setCopied(false);
		const submittedEmail = email;
		const formData = new FormData();
		formData.set("email", email);
		formData.set("role", role);
		startTransition(async () => {
			const result = await inviteMemberAction(formData);
			if (!result.ok) {
				setError(result.error);
				if (result.fieldErrors) setFieldErrors(result.fieldErrors);
				return;
			}
			setCreated({
				email: submittedEmail,
				url: result.inviteUrl,
				expiresAt: result.expiresAt,
				emailDelivered: result.emailDelivered,
			});
			setEmail("");
			setRole(defaultRole);
		});
	}

	async function handleCopy() {
		if (!created) return;
		try {
			await navigator.clipboard.writeText(created.url);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard may be unavailable (insecure context, permission); the
			// raw URL is still visible in the input, so this is recoverable.
		}
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="grid gap-4 md:grid-cols-[1fr_200px_auto] md:items-end">
				<div className="space-y-1.5">
					<Label htmlFor="invite-email">{labels.emailLabel}</Label>
					<Input
						id="invite-email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder={labels.emailPlaceholder}
						disabled={isPending}
						required
					/>
					{fieldErrors.email?.[0] ? (
						<p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
					) : null}
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="invite-role">{labels.roleLabel}</Label>
					<Select value={role} onValueChange={setRole} disabled={isPending}>
						<SelectTrigger id="invite-role">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{labels.roleOptions.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									<div>
										<span className="font-medium">{opt.label}</span>
										{ROLE_DESCRIPTIONS[opt.value] ? (
											<span className="block text-xs font-normal text-muted-foreground">
												{ROLE_DESCRIPTIONS[opt.value]}
											</span>
										) : null}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Button type="submit" disabled={isPending}>
					{labels.submit}
				</Button>
			</div>

			{/* Phase 5.7 — expiry note below the form */}
			<p className="text-xs text-muted-foreground">
				Invitations expire after 14 days. Teammates without an account will be
				prompted to create one. You can revoke pending invitations at any time
				from the table below.
			</p>

			{error ? <p className="text-sm text-destructive">{error}</p> : null}

			{created ? (
				<div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
					<p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
						{created.emailDelivered
							? labels.successEmailSent
							: labels.successLinkOnly}
					</p>
					<p className="text-xs text-emerald-800 dark:text-emerald-200">
						{labels.linkHelp.replace("{email}", created.email).replace(
							"{expires}",
							new Intl.DateTimeFormat(locale, {
								dateStyle: "medium",
								timeStyle: "short",
							}).format(created.expiresAt),
						)}
					</p>
					<div className="space-y-1.5">
						<Label htmlFor="invite-url" className="sr-only">
							{labels.linkHeading}
						</Label>
						<div className="flex gap-2">
							<Input
								id="invite-url"
								value={created.url}
								readOnly
								onFocus={(e) => e.currentTarget.select()}
								className="font-mono text-xs"
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleCopy}
							>
								{copied ? (
									<>
										<Check className="mr-1 h-3.5 w-3.5" />
										{labels.copied}
									</>
								) : (
									<>
										<Copy className="mr-1 h-3.5 w-3.5" />
										{labels.copy}
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</form>
	);
}
