import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type Role, type SessionUser } from "@/lib/auth/session";

/** Server-side page guard for role-restricted surfaces. */
export async function requireRolePage(
  ...allowed: Array<Role | "coach_or_admin">
): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  if (!session.onboarded) redirect("/auth/onboarding");

  const role = session.role as Role;
  const permitted =
    role === "admin" ||
    (allowed.includes("coach_or_admin") && role === "coach") ||
    allowed.includes(role);

  if (!permitted) redirect("/dashboard");
  return session;
}
