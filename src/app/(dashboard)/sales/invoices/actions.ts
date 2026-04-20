"use server";

import { revalidatePath } from "next/cache";
import { computeNetWeight, lineTotalFromNetWeight } from "@/lib/units/hk-catty-tael";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export type CustomerOption = {
  id: string;
  name: string;
  payment_term: "cod" | "credit" | "installment";
};

export type ProductOption = {
  id: string;
  name: string;
  spec: string | null;
  sale_unit: "piece" | "jin" | "catty" | "kg";
  is_active: boolean;
};

export type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  total_amount: number;
  status: "draft" | "confirmed" | "cancelled";
};

export type InvoicePageDataResult =
  | {
      ok: true;
      customers: CustomerOption[];
      products: ProductOption[];
      invoices: InvoiceRow[];
    }
  | { ok: false; code: "not_configured" }
  | { ok: false; code: "db_error"; message: string };

export type CreateInvoiceState = {
  ok: boolean;
  message: string | null;
};

export type ChangeInvoiceStatus = "draft" | "confirmed" | "cancelled";

function toNumber(input: FormDataEntryValue | null): number {
  const value = Number(String(input ?? "").trim());
  if (!Number.isFinite(value)) {
    throw new TypeError("欄位格式錯誤，請輸入數字");
  }
  return value;
}

function toNumberList(values: FormDataEntryValue[]): number[] {
  return values.map((value) => toNumber(value));
}

function todayKey(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

async function createReadableInvoiceNo(
  supabase: ReturnType<typeof createAdminClient>,
  date: Date,
): Promise<{ ok: true; invoiceNo: string } | { ok: false; message: string }> {
  const dayKey = todayKey(date);
  const prefix = `SI-${dayKey}-`;

  const { data, error } = await supabase
    .from("sales_invoices")
    .select("invoice_no")
    .ilike("invoice_no", `${prefix}%`)
    .order("invoice_no", { ascending: false })
    .limit(1);

  if (error) {
    return { ok: false, message: `生成發票號失敗：${error.message}` };
  }

  const latest = data?.[0]?.invoice_no ?? null;
  const lastSeq = latest ? Number(String(latest).slice(prefix.length)) : 0;
  const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  const readableNo = `${prefix}${String(nextSeq).padStart(4, "0")}`;
  return { ok: true, invoiceNo: readableNo };
}

type DeductionLine = {
  productId: string;
  unit: "piece" | "jin" | "catty" | "kg";
  quantity: number;
};

async function deductInventoryForInvoice(params: {
  supabase: ReturnType<typeof createAdminClient>;
  invoiceId: string;
  lines: DeductionLine[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, invoiceId, lines } = params;

  // Merge lines by product+unit to perform FIFO deductions once per bucket.
  const bucketMap = new Map<string, { productId: string; unit: DeductionLine["unit"]; required: number }>();
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const key = `${line.productId}:${line.unit}`;
    const existing = bucketMap.get(key);
    if (existing) {
      existing.required += line.quantity;
    } else {
      bucketMap.set(key, { productId: line.productId, unit: line.unit, required: line.quantity });
    }
  }

  for (const bucket of bucketMap.values()) {
    const { data: batches, error: batchError } = await supabase
      .from("inventory_batches")
      .select("id, batch_code, quantity_remaining")
      .eq("product_id", bucket.productId)
      .eq("unit", bucket.unit)
      .gt("quantity_remaining", 0)
      .order("received_at", { ascending: true });

    if (batchError) {
      return { ok: false, message: `扣庫存失敗：${batchError.message}` };
    }

    const fifoBatches = batches ?? [];
    const totalAvailable = fifoBatches.reduce(
      (sum, batch) => sum + Number(batch.quantity_remaining ?? 0),
      0,
    );
    if (totalAvailable < bucket.required) {
      return {
        ok: false,
        message: `庫存不足（產品 ${bucket.productId}，單位 ${bucket.unit}）：需要 ${bucket.required.toFixed(
          3,
        )}，可用 ${totalAvailable.toFixed(3)}`,
      };
    }

    let remaining = bucket.required;
    for (const batch of fifoBatches) {
      if (remaining <= 0) break;
      const available = Number(batch.quantity_remaining ?? 0);
      const deductQty = Math.min(remaining, available);
      if (deductQty <= 0) continue;

      const { error: updateBatchError } = await supabase
        .from("inventory_batches")
        .update({ quantity_remaining: available - deductQty })
        .eq("id", batch.id);
      if (updateBatchError) {
        return { ok: false, message: `更新庫存批次失敗：${updateBatchError.message}` };
      }

      const { error: movementError } = await supabase.from("inventory_movements").insert({
        batch_id: batch.id,
        product_id: bucket.productId,
        movement_type: "sale_out",
        quantity_delta: -deductQty,
        unit: bucket.unit,
        reference_table: "sales_invoices",
        reference_id: invoiceId,
        notes: `發票自動扣庫存`,
      });
      if (movementError) {
        return { ok: false, message: `寫入庫存流水失敗：${movementError.message}` };
      }

      remaining -= deductQty;
    }
  }

  return { ok: true };
}

async function restoreInventoryForCancelledInvoice(params: {
  supabase: ReturnType<typeof createAdminClient>;
  invoiceId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, invoiceId } = params;

  const { data: saleOutMovements, error: movementsError } = await supabase
    .from("inventory_movements")
    .select("id, batch_id, product_id, quantity_delta, unit")
    .eq("reference_table", "sales_invoices")
    .eq("reference_id", invoiceId)
    .eq("movement_type", "sale_out");

  if (movementsError) {
    return { ok: false, message: `讀取扣庫存流水失敗：${movementsError.message}` };
  }

  for (const movement of saleOutMovements ?? []) {
    const deductedQty = Number(movement.quantity_delta ?? 0);
    if (deductedQty >= 0) {
      continue;
    }
    if (!movement.batch_id) {
      return { ok: false, message: "存在缺少 batch_id 的扣庫存流水，無法回補" };
    }
    const restoreQty = -deductedQty;

    const { data: batchRow, error: batchError } = await supabase
      .from("inventory_batches")
      .select("id, quantity_remaining")
      .eq("id", movement.batch_id)
      .single();
    if (batchError || !batchRow) {
      return { ok: false, message: batchError?.message ?? "找不到對應批次，無法回補庫存" };
    }

    const nextRemaining = Number(batchRow.quantity_remaining ?? 0) + restoreQty;
    const { error: updateBatchError } = await supabase
      .from("inventory_batches")
      .update({ quantity_remaining: nextRemaining })
      .eq("id", movement.batch_id);
    if (updateBatchError) {
      return { ok: false, message: `回補批次庫存失敗：${updateBatchError.message}` };
    }

    const { error: reverseMovementError } = await supabase.from("inventory_movements").insert({
      batch_id: movement.batch_id,
      product_id: movement.product_id,
      movement_type: "adjustment",
      quantity_delta: restoreQty,
      unit: movement.unit,
      reference_table: "sales_invoices",
      reference_id: invoiceId,
      notes: "發票作廢自動回補庫存",
    });
    if (reverseMovementError) {
      return { ok: false, message: `寫入回補流水失敗：${reverseMovementError.message}` };
    }
  }

  return { ok: true };
}

export async function getInvoicePageData(): Promise<InvoicePageDataResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  const supabase = createAdminClient();

  const [customersResult, productsResult, invoicesResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, payment_term")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("id, name, spec, sale_unit, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("sales_invoices")
      .select("id, invoice_no, invoice_date, total_amount, status, customers(name)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (customersResult.error) {
    return { ok: false, code: "db_error", message: customersResult.error.message };
  }
  if (productsResult.error) {
    return { ok: false, code: "db_error", message: productsResult.error.message };
  }
  if (invoicesResult.error) {
    return { ok: false, code: "db_error", message: invoicesResult.error.message };
  }

  const invoices: InvoiceRow[] = (invoicesResult.data ?? []).map((row) => {
    const customerCell = row.customers as { name: string } | { name: string }[] | null;
    const customerName = Array.isArray(customerCell)
      ? (customerCell[0]?.name ?? "—")
      : (customerCell?.name ?? "—");
    return {
      id: row.id,
      invoice_no: row.invoice_no,
      invoice_date: row.invoice_date,
      customer_name: customerName,
      total_amount: Number(row.total_amount ?? 0),
      status: row.status,
    };
  });

  return {
    ok: true,
    customers: (customersResult.data ?? []) as CustomerOption[],
    products: (productsResult.data ?? []) as ProductOption[],
    invoices,
  };
}

export async function createInvoice(
  _prev: CreateInvoiceState,
  formData: FormData,
): Promise<CreateInvoiceState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) {
    return { ok: false, message: "請先選擇客戶" };
  }
  const productIds = formData
    .getAll("line_product_id")
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  if (productIds.length === 0) {
    return { ok: false, message: "請至少新增一行產品" };
  }

  let grossWeights: number[] = [];
  let basketWeights: number[] = [];
  let moistureDeductions: number[] = [];
  let unitPrices: number[] = [];
  try {
    grossWeights = toNumberList(formData.getAll("line_gross_weight"));
    basketWeights = toNumberList(formData.getAll("line_basket_weight"));
    moistureDeductions = toNumberList(formData.getAll("line_moisture_deduction"));
    unitPrices = toNumberList(formData.getAll("line_unit_price"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "欄位格式錯誤";
    return { ok: false, message };
  }

  if (
    !(
      productIds.length === grossWeights.length &&
      productIds.length === basketWeights.length &&
      productIds.length === moistureDeductions.length &&
      productIds.length === unitPrices.length
    )
  ) {
    return { ok: false, message: "行資料不完整，請檢查每行產品、重量與單價" };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const supabase = createAdminClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, payment_term")
    .eq("id", customerId)
    .single();
  if (customerError || !customer) {
    return { ok: false, message: customerError?.message ?? "找不到客戶資料" };
  }

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, spec, sale_unit")
    .in("id", productIds);
  if (productError || !products || products.length === 0) {
    return { ok: false, message: productError?.message ?? "找不到產品資料" };
  }
  const productMap = new Map(products.map((product) => [product.id, product]));

  const lineRows: Array<{
    line_no: number;
    product_id: string;
    name: string;
    spec: string | null;
    unit: "piece" | "jin" | "catty" | "kg";
    unit_price: number;
    gross_weight: number;
    basket_weight: number;
    moisture_deduction: number;
    net_weight: number;
    line_total: number;
  }> = [];

  let subtotal = 0;
  for (let idx = 0; idx < productIds.length; idx += 1) {
    const product = productMap.get(productIds[idx]);
    if (!product) {
      return { ok: false, message: `第 ${idx + 1} 行產品不存在或已停用` };
    }
    const grossWeight = grossWeights[idx];
    const basketWeight = basketWeights[idx];
    const moistureDeduction = moistureDeductions[idx];
    const unitPrice = unitPrices[idx];

    try {
      const netWeight = computeNetWeight({
        grossWeight,
        basketTare: basketWeight,
        moistureDeduction,
      });
      const lineTotal = lineTotalFromNetWeight({
        netWeight,
        unitPrice,
        netWeightFractionDigits: 3,
      });
      subtotal += lineTotal;
      lineRows.push({
        line_no: idx + 1,
        product_id: product.id,
        name: product.name,
        spec: product.spec,
        unit: product.sale_unit,
        unit_price: unitPrice,
        gross_weight: grossWeight,
        basket_weight: basketWeight,
        moisture_deduction: moistureDeduction,
        net_weight: netWeight,
        line_total: lineTotal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "重量資料錯誤";
      return { ok: false, message: `第 ${idx + 1} 行：${message}` };
    }
  }

  let createdInvoice: { id: string } | null = null;
  let invoiceNo = "";
  const maxInsertRetries = 5;

  for (let attempt = 0; attempt < maxInsertRetries; attempt += 1) {
    const invoiceNoResult = await createReadableInvoiceNo(supabase, new Date());
    if (!invoiceNoResult.ok) {
      return { ok: false, message: invoiceNoResult.message };
    }
    invoiceNo = invoiceNoResult.invoiceNo;

    const { data: inserted, error: invoiceError } = await supabase
      .from("sales_invoices")
      .insert({
        invoice_no: invoiceNo,
        customer_id: customer.id,
        payment_term: customer.payment_term,
        status: "draft",
        subtotal,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: subtotal,
        notes,
      })
      .select("id")
      .single();

    if (!invoiceError && inserted) {
      createdInvoice = inserted as { id: string };
      break;
    }

    // Unique conflict: concurrent invoice creation may claim same sequence. Retry.
    if (invoiceError?.code === "23505") {
      continue;
    }

    return { ok: false, message: invoiceError?.message ?? "建立發票失敗，請稍後再試" };
  }

  if (!createdInvoice) {
    return { ok: false, message: "發票號已被佔用，請稍後再試" };
  }

  const { error: lineError } = await supabase.from("sales_invoice_lines").insert(
    lineRows.map((line) => ({
      ...line,
      invoice_id: createdInvoice.id,
    })),
  );

  if (lineError) {
    await supabase.from("sales_invoices").delete().eq("id", createdInvoice.id);
    return { ok: false, message: lineError.message };
  }

  const deductionResult = await deductInventoryForInvoice({
    supabase,
    invoiceId: createdInvoice.id,
    lines: lineRows.map((line) => ({
      productId: line.product_id,
      unit: line.unit,
      quantity: line.net_weight,
    })),
  });
  if (!deductionResult.ok) {
    // Best-effort rollback when auto-deduction fails.
    await supabase.from("sales_invoice_lines").delete().eq("invoice_id", createdInvoice.id);
    await supabase.from("sales_invoices").delete().eq("id", createdInvoice.id);
    return { ok: false, message: deductionResult.message };
  }

  revalidatePath("/sales/invoices");
  revalidatePath("/inventory/batches");
  revalidatePath("/inventory/movements");
  return { ok: true, message: `已建立草稿發票 ${invoiceNo}（${lineRows.length} 行）` };
}

export async function changeInvoiceStatus(
  invoiceId: string,
  targetStatus: ChangeInvoiceStatus,
): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const supabase = createAdminClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("sales_invoices")
    .select("id, invoice_no, status, amount_paid")
    .eq("id", invoiceId)
    .single();
  if (invoiceError || !invoice) {
    return { ok: false, message: invoiceError?.message ?? "找不到發票" };
  }

  if (invoice.status === targetStatus) {
    return { ok: true, message: `發票 ${invoice.invoice_no} 已是 ${targetStatus}` };
  }

  if (targetStatus === "confirmed") {
    if (invoice.status !== "draft") {
      return { ok: false, message: "只有草稿發票可以確認" };
    }
  }

  if (targetStatus === "cancelled") {
    if (Number(invoice.amount_paid ?? 0) > 0) {
      return { ok: false, message: "已有收款紀錄，請先沖銷收款後再作廢" };
    }
    const restoreResult = await restoreInventoryForCancelledInvoice({
      supabase,
      invoiceId: invoice.id,
    });
    if (!restoreResult.ok) {
      return { ok: false, message: restoreResult.message };
    }
  }

  const { error: updateError } = await supabase
    .from("sales_invoices")
    .update({ status: targetStatus })
    .eq("id", invoice.id);
  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath("/sales/invoices");
  revalidatePath("/sales/ar");
  revalidatePath("/inventory/batches");
  revalidatePath("/inventory/movements");
  return { ok: true, message: `已更新發票 ${invoice.invoice_no} 狀態為 ${targetStatus}` };
}
