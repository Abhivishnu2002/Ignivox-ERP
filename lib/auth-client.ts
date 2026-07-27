import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

function getClientBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  let url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/$/, "");
}

export const authClient = createAuthClient({
  baseURL: getClientBaseUrl(),
  plugins: [organizationClient()],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  organization,
} = authClient;
