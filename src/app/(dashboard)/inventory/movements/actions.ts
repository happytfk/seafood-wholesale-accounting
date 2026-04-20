"use server";

import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

type WeightUnit = "piece" | "jin" | "catty" | "kg";
type MovementType = "purchase_in" | "sale_out" | "adjustment" | "transfer" | "wastage";

export type MovementProductOption = {
  id: string;
  name: string;
};

export type MovementRow = {
  id: string;
  created_at: string;
  movement_type: MovementType;
  product_name: string;
  batch_code: string | null;
  quantity_delta: number;
  unit: WeightUnit;
  reference_table: string | null;
  reference_id: string | null;
  notes: string | null;
};

export type MovementsPageResult =
  | {
      ok: true;
      products: MovementProductOption[];
      movements: MovementRow[];
      filters: {
        productId: string;
        movementType: "all" | MovementType;
        fromDate: string;
        toDate: string;
      };
      pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
      };
    }
  | { ok: false; code: "not_configured" }
  | { ok: false; code: "db_error"; message: string };

function clampPage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
}

export async function getMovementsPageData(params?: {
  productId?: string;
  movementType?: string;
  fromDate?: string;
  toDate?: string;
  page?: string;
}): Promise<MovementsPageResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  const productId = String(params?.productId ?? "").trim();
  const movementTypeInput = String(params?.movementType ?? "all").trim();
  const movementType =
    movementTypeInput === "purchase_in" ||
    movementTypeInput === "sale_out" ||
    movementTypeInput === "adjustment" ||
    movementTypeInput === "transfer" ||
    movementTypeInput === "wastage"
      ? movementTypeInput
      : "all";
  const fromDate = String(params?.fromDate ?? "").trim();
  const toDate = String(params?.toDate ?? "").trim();
  const page = clampPage(params?.page);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const supabase = createAdminClient();

  const [productsResult, movementsResult] = await Promise.all([
    supabase.from("products").select("id, name").eq("is_active", true).order("name", { ascending: true }),
    (async () => {
      let query = supabase
        .from("inventory_movements")
        .select(
          "id, created_at, movement_type, quantity_delta, unit, reference_table, reference_id, notes, products(name), inventory_batches(batch_code)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (productId) {
        query = query.eq("product_id", productId);
      }
      if (movementType !== "all") {
        query = query.eq("movement_type", movementType);
      }
      if (fromDate) {
        query = query.gte("created_at", `${fromDate}T00:00:00+08:00`);
      }
      if (toDate) {
        query = query.lte("created_at", `${toDate}T23:59:59+08:00`);
      }
      return query;
    })(),
  ]);

  if (productsResult.error) {
    return { ok: false, code: "db_error", message: productsResult.error.message };
  }
  if (movementsResult.error) {
    return { ok: false, code: "db_error", message: movementsResult.error.message };
  }

  const movements: MovementRow[] = (movementsResult.data ?? []).map((row) => {
    const productCell = row.products as { name: string } | { name: string }[] | null;
    const batchCell = row.inventory_batches as { batch_code: string | null } | { batch_code: string | null }[] | null;
    const productName = Array.isArray(productCell) ? (productCell[0]?.name ?? "—") : (productCell?.name ?? "—");
    const batchCode = Array.isArray(batchCell)
      ? (batchCell[0]?.batch_code ?? null)
      : (batchCell?.batch_code ?? null);
    return {
      id: row.id,
      created_at: String(row.created_at),
      movement_type: row.movement_type,
      product_name: productName,
      batch_code: batchCode,
      quantity_delta: Number(row.quantity_delta ?? 0),
      unit: row.unit,
      reference_table: row.reference_table,
      reference_id: row.reference_id,
      notes: row.notes,
    };
  });

  const totalCount = Number(movementsResult.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    ok: true,
    products: (productsResult.data ?? []) as MovementProductOption[],
    movements,
    filters: {
      productId,
      movementType,
      fromDate,
      toDate,
    },
    pagination: {
      page: Math.min(page, totalPages),
      pageSize,
      totalCount,
      totalPages,
    },
  };
}
