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
  const productId = String(formData.get("product_id") ?? "");
  if (!customerId) {
    return { ok: false, message: "請先選擇客戶" };
  }
  if (!productId) {
    return { ok: false, message: "請先選擇產品" };
  }

  let grossWeight = 0;
  let basketWeight = 0;
  let moistureDeduction = 0;
  let unitPrice = 0;
  try {
    grossWeight = toNumber(formData.get("gross_weight"));
    basketWeight = toNumber(formData.get("basket_weight"));
    moistureDeduction = toNumber(formData.get("moisture_deduction"));
    unitPrice = toNumber(formData.get("unit_price"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "欄位格式錯誤";
    return { ok: false, message };
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

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, spec, sale_unit")
    .eq("id", productId)
    .single();
  if (productError || !product) {
    return { ok: false, message: productError?.message ?? "找不到產品資料" };
  }

  let netWeight = 0;
  let lineTotal = 0;
  try {
    netWeight = computeNetWeight({
      grossWeight,
      basketTare: basketWeight,
      moistureDeduction,
    });
    lineTotal = lineTotalFromNetWeight({
      netWeight,
      unitPrice,
      netWeightFractionDigits: 3,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "重量資料錯誤";
    return { ok: false, message };
  }

  const invoiceNo = createInvoiceNo();
  const { data: createdInvoice, error: invoiceError } = await supabase
    .from("sales_invoices")
    .insert({
      invoice_no: invoiceNo,
      customer_id: customer.id,
      payment_term: customer.payment_term,
      status: "draft",
      subtotal: lineTotal,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: lineTotal,
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

  const { error: lineError } = await supabase.from("sales_invoice_lines").insert({
    invoice_id: createdInvoice.id,
    line_no: 1,
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

  if (lineError) {
    await supabase.from("sales_invoices").delete().eq("id", createdInvoice.id);
    return { ok: false, message: lineError.message };
  }

  revalidatePath("/sales/invoices");
  return { ok: true, message: `已建立草稿發票 ${invoiceNo}` };
}
