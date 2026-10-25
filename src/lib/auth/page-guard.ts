import "server-only";
import { loginPath, onboardingPath } from "@/lib/auth/return-path";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { canAccessRole, type AccessScope } from "@/lib/auth/access-policy";

/** Server-side page guard for role-restricted surfaces. */
export async function requireRolePage(
  destination: string,
  ...allowed: AccessScope[]
): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect(loginPath(destination));
  if (session.role === "member" && !session.onboarded) redirect(onboardingPath(destination));

  if (!allowed.some((scope) => canAccessRole(session.role, scope))) redirect(session.role === "admin" ? "/admin" : "/dashboard");
  return session;
}
