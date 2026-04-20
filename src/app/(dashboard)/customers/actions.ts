"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export type CustomerRow = {
  id: string;
  code: string | null;
  name: string;
  segment: string;
  phone: string | null;
  payment_term: string;
  is_active: boolean;
};

export type GetCustomersResult =
  | { ok: true; customers: CustomerRow[] }
  | { ok: false; code: "not_configured" }
  | { ok: false; code: "db_error"; message: string };

export async function getCustomersResult(): Promise<GetCustomersResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured" };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, code, name, segment, phone, payment_term, is_active")
    .order("name", { ascending: true });

  if (error) {
    return { ok: false, code: "db_error", message: error.message };
  }
  return { ok: true, customers: (data ?? []) as CustomerRow[] };
}

export type AddCustomerState = {
  ok: boolean;
  message: string | null;
};

export async function addCustomer(
  _prev: AddCustomerState,
  formData: FormData,
): Promise<AddCustomerState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, message: "請輸入客戶名稱" };
  }

  const segment = String(formData.get("segment") ?? "other");
  const phone = String(formData.get("phone") ?? "").trim() || null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("customers").insert({
    name,
    segment,
    phone,
    payment_term: "credit",
    is_active: true,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/customers");
  return { ok: true, message: null };
}
