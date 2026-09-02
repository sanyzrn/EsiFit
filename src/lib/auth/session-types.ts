/**
 * Client-safe session types shared between server and browser bundles.
 * session.ts is server-only; client components import from here.
 */

export type Role = "member" | "coach" | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  member: "ورزشکار",
  coach: "مربی",
  admin: "مدیر",
};

export type ClientSession = {
  id: string;
  phone: string;
  displayName: string;
  role: Role;
  tier: string;
  onboarded: boolean;
};
