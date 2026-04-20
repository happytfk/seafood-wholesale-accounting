"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  spec: string | null;
  pricing_method: "per_piece" | "per_weight";
  sale_unit: "piece" | "jin" | "catty" | "kg";
  stock_unit: "piece" | "jin" | "catty" | "kg";
  is_active: boolean;
};

export type GetProductsResult =
  | { ok: true; products: ProductRow[] }
  | { ok: false; code: "not_configured" }
  | { ok: false; code: "db_error"; message: string };

export type AddProductState = {
  ok: boolean;
  message: string | null;
};

export async function getProductsResult(): Promise<GetProductsResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, spec, pricing_method, sale_unit, stock_unit, is_active")
    .order("name", { ascending: true });

  if (error) {
    return { ok: false, code: "db_error", message: error.message };
  }

  return { ok: true, products: (data ?? []) as ProductRow[] };
}

export async function addProduct(
  _prev: AddProductState,
  formData: FormData,
): Promise<AddProductState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, message: "請輸入產品名稱" };
  }

  const skuRaw = String(formData.get("sku") ?? "").trim();
  const sku = skuRaw ? skuRaw.toUpperCase() : null;
  const spec = String(formData.get("spec") ?? "").trim() || null;
  const pricingMethod = String(formData.get("pricing_method") ?? "per_weight");
  const saleUnit = String(formData.get("sale_unit") ?? "kg");
  const stockUnit = String(formData.get("stock_unit") ?? saleUnit);

  const supabase = createAdminClient();
  const { error } = await supabase.from("products").insert({
    sku,
    name,
    spec,
    pricing_method: pricingMethod,
    sale_unit: saleUnit,
    stock_unit: stockUnit,
    is_active: true,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/products");
  return { ok: true, message: null };
}

export async function toggleProductActive(
  id: string,
  nextActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: nextActive })
    .eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/products");
  return { ok: true };
}
