import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { canAccessRole, type AccessScope } from "@/lib/auth/access-policy";

/** Server-side page guard for role-restricted surfaces. */
export async function requireRolePage(
  ...allowed: AccessScope[]
): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  if (!session.onboarded) redirect("/auth/onboarding");

  if (!allowed.some((scope) => canAccessRole(session.role, scope))) redirect(session.role === "admin" ? "/admin" : "/dashboard");
  return session;
}
