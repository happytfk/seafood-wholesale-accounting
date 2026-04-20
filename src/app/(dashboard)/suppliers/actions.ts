"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export type SupplierRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

export type GetSuppliersResult =
  | { ok: true; suppliers: SupplierRow[] }
  | { ok: false; code: "not_configured" }
  | { ok: false; code: "db_error"; message: string };

export type AddSupplierState = {
  ok: boolean;
  message: string | null;
};

export async function getSuppliersResult(): Promise<GetSuppliersResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, code, name, phone, address, notes, is_active")
    .order("name", { ascending: true });

  if (error) {
    return { ok: false, code: "db_error", message: error.message };
  }

  return { ok: true, suppliers: (data ?? []) as SupplierRow[] };
}

export async function addSupplier(
  _prev: AddSupplierState,
  formData: FormData,
): Promise<AddSupplierState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, message: "請輸入供應商名稱" };
  }

  const codeRaw = String(formData.get("code") ?? "").trim();
  const code = codeRaw ? codeRaw.toUpperCase() : null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("suppliers").insert({
    code,
    name,
    phone,
    address,
    notes,
    is_active: true,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/suppliers");
  return { ok: true, message: null };
}

export async function toggleSupplierActive(
  id: string,
  nextActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: nextActive })
    .eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/suppliers");
  return { ok: true };
}
