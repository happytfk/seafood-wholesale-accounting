"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

type WeightUnit = "piece" | "jin" | "catty" | "kg";

export type BatchSupplierOption = {
  id: string;
  name: string;
};

export type BatchProductOption = {
  id: string;
  name: string;
  spec: string | null;
  stock_unit: WeightUnit;
};

export type BatchRow = {
  id: string;
  batch_code: string | null;
  received_at: string;
  unit: WeightUnit;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  supplier_name: string;
  product_name: string;
  product_spec: string | null;
};

export type BatchesPageResult =
  | {
      ok: true;
      suppliers: BatchSupplierOption[];
      products: BatchProductOption[];
      batches: BatchRow[];
      summary: {
        totalBatches: number;
        openBatches: number;
        depletedBatches: number;
      };
      filters: {
        productId: string;
        supplierId: string;
        onlyOpen: boolean;
      };
    }
  | { ok: false; code: "not_configured" }
  | { ok: false; code: "db_error"; message: string };

export type AddBatchState = {
  ok: boolean;
  message: string | null;
};

function toNumber(input: FormDataEntryValue | null): number {
  const value = Number(String(input ?? "").trim());
  if (!Number.isFinite(value)) {
    throw new TypeError("數值格式錯誤");
  }
  return value;
}

export async function getBatchesPageData(params?: {
  productId?: string;
  supplierId?: string;
  onlyOpen?: string;
}): Promise<BatchesPageResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  const productId = String(params?.productId ?? "").trim();
  const supplierId = String(params?.supplierId ?? "").trim();
  const onlyOpen = String(params?.onlyOpen ?? "").trim() === "1";
  const supabase = createAdminClient();

  const [suppliersResult, productsResult, batchesResult] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name", { ascending: true }),
    supabase
      .from("products")
      .select("id, name, spec, stock_unit")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    (async () => {
      let query = supabase
        .from("inventory_batches")
        .select(
          "id, batch_code, received_at, unit, quantity_received, quantity_remaining, unit_cost, suppliers(name), products(name, spec)",
        )
        .order("received_at", { ascending: false })
        .limit(100);

      if (productId) {
        query = query.eq("product_id", productId);
      }
      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }
      if (onlyOpen) {
        query = query.gt("quantity_remaining", 0);
      }
      return query;
    })(),
  ]);

  if (suppliersResult.error) {
    return { ok: false, code: "db_error", message: suppliersResult.error.message };
  }
  if (productsResult.error) {
    return { ok: false, code: "db_error", message: productsResult.error.message };
  }
  if (batchesResult.error) {
    return { ok: false, code: "db_error", message: batchesResult.error.message };
  }

  const batches: BatchRow[] = (batchesResult.data ?? []).map((row) => {
    const supplierCell = row.suppliers as { name: string } | { name: string }[] | null;
    const productCell = row.products as { name: string; spec: string | null } | { name: string; spec: string | null }[] | null;
    const supplierName = Array.isArray(supplierCell)
      ? (supplierCell[0]?.name ?? "—")
      : (supplierCell?.name ?? "—");
    const productName = Array.isArray(productCell) ? (productCell[0]?.name ?? "—") : (productCell?.name ?? "—");
    const productSpec = Array.isArray(productCell)
      ? (productCell[0]?.spec ?? null)
      : (productCell?.spec ?? null);
    return {
      id: row.id,
      batch_code: row.batch_code,
      received_at: String(row.received_at).slice(0, 10),
      unit: row.unit,
      quantity_received: Number(row.quantity_received ?? 0),
      quantity_remaining: Number(row.quantity_remaining ?? 0),
      unit_cost: Number(row.unit_cost ?? 0),
      supplier_name: supplierName,
      product_name: productName,
      product_spec: productSpec,
    };
  });

  return {
    ok: true,
    suppliers: (suppliersResult.data ?? []) as BatchSupplierOption[],
    products: (productsResult.data ?? []) as BatchProductOption[],
    batches,
    summary: {
      totalBatches: batches.length,
      openBatches: batches.filter((b) => b.quantity_remaining > 0).length,
      depletedBatches: batches.filter((b) => b.quantity_remaining <= 0).length,
    },
    filters: {
      productId,
      supplierId,
      onlyOpen,
    },
  };
}

export async function addInventoryBatch(
  _prev: AddBatchState,
  formData: FormData,
): Promise<AddBatchState> {
  try {
    await requireRole(["owner", "accountant", "manager"]);
  } catch {
    return { ok: false, message: "你無權限新增入庫批次" };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const batchCode = String(formData.get("batch_code") ?? "").trim() || null;
  const unit = String(formData.get("unit") ?? "").trim() as WeightUnit;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const receivedDate = String(formData.get("received_date") ?? "").trim();

  if (!supplierId) return { ok: false, message: "請選擇供應商" };
  if (!productId) return { ok: false, message: "請選擇產品" };
  if (!["piece", "jin", "catty", "kg"].includes(unit)) {
    return { ok: false, message: "請選擇有效單位" };
  }

  let quantityReceived = 0;
  let unitCost = 0;
  try {
    quantityReceived = toNumber(formData.get("quantity_received"));
    unitCost = toNumber(formData.get("unit_cost"));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "數值格式錯誤" };
  }
  if (quantityReceived <= 0) return { ok: false, message: "入庫數量必須大於 0" };
  if (unitCost < 0) return { ok: false, message: "入貨單價不可小於 0" };

  const supabase = createAdminClient();
  const receivedAt = receivedDate ? `${receivedDate}T12:00:00+08:00` : new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("inventory_batches")
    .insert({
      supplier_id: supplierId,
      product_id: productId,
      batch_code: batchCode,
      received_at: receivedAt,
      unit,
      quantity_received: quantityReceived,
      quantity_remaining: quantityReceived,
      unit_cost: unitCost,
      notes,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { ok: false, message: insertError?.message ?? "新增批次失敗" };
  }

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    batch_id: inserted.id,
    product_id: productId,
    movement_type: "purchase_in",
    quantity_delta: quantityReceived,
    unit,
    reference_table: "inventory_batches",
    reference_id: inserted.id,
    notes: "建立入庫批次自動寫入",
  });

  if (movementError) {
    await supabase.from("inventory_batches").delete().eq("id", inserted.id);
    return { ok: false, message: `新增批次流水失敗：${movementError.message}` };
  }

  revalidatePath("/inventory/batches");
  revalidatePath("/inventory/movements");
  return { ok: true, message: "已新增入庫批次" };
}
