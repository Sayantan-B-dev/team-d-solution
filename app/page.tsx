import SiteShell from "@/components/site/SiteShell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  auth_cancelled: "Sign-in was cancelled. You can try again anytime.",
  auth_state: "That sign-in attempt expired. Please try again.",
  auth_failed: "Google sign-in failed. Please try again.",
  config: "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI.",
  server: "Something went wrong while signing you in. Please try again.",
};

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams]);

  const rawError = params?.error;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  const authError = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Please try again.")
    : null;

  return <SiteShell user={user} authError={authError} />;
}
