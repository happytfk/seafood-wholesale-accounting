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

function createInvoiceNo(): string {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];
  return `SI-${parts.join("")}`;
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

  const invoiceNo = createInvoiceNo();
  const { data: createdInvoice, error: invoiceError } = await supabase
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

  if (invoiceError || !createdInvoice) {
    return {
      ok: false,
      message: invoiceError?.message ?? "建立發票失敗，請稍後再試",
    };
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

  revalidatePath("/sales/invoices");
  return { ok: true, message: `已建立草稿發票 ${invoiceNo}（${lineRows.length} 行）` };
}
