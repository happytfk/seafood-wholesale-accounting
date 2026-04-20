import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

export type AppRole = "owner" | "manager" | "staff" | "accountant";

export type AuthContext = {
  userId: string;
  email: string | null;
  role: AppRole;
};

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createServerAuthClient();
  if (!supabase) {
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as AppRole | undefined) ?? "staff";
  return {
    userId: user.id,
    email: user.email ?? null,
    role,
  };
});

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }
  return auth;
}

export async function requireRole(allowedRoles: AppRole[]): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!allowedRoles.includes(auth.role)) {
    throw new Error("你無權限執行此操作");
  }
  return auth;
}
