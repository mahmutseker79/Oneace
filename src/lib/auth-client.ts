"use client";

import { createAuthClient } from "better-auth/react";

// Use NEXT_PUBLIC_APP_URL if set, otherwise auto-detect from window.location
// This fixes the login redirect issue on Vercel where the env var may not be set.
function getBaseURL(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
