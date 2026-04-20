"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export type ArCustomerOption = {
  id: string;
  name: string;
};

export type MonthlyInvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: "draft" | "confirmed" | "cancelled";
};

export type MonthlyStatementSummary = {
  openingBalance: number;
  periodInvoiced: number;
  periodPaid: number;
  closingBalance: number;
};

export type ArAgingSummary = {
  current: number;
  bucket0To30: number;
  bucket31To60: number;
  bucket61To90: number;
  bucket90Plus: number;
  totalOutstanding: number;
};

export type ReceivableInvoiceOption = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  balance_due: number;
};

export type AddReceiptState = {
  ok: boolean;
  message: string | null;
};

export type MonthlyStatementResult =
  | {
      ok: true;
      month: string;
      customers: ArCustomerOption[];
      selectedCustomerId: string;
      selectedCustomerName: string;
      summary: MonthlyStatementSummary;
      aging: ArAgingSummary;
      invoices: MonthlyInvoiceRow[];
      receivableInvoices: ReceivableInvoiceOption[];
    }
  | { ok: false; code: "not_configured" }
  | { ok: false; code: "db_error"; message: string };

function monthStartAndEnd(month: string): { start: string; endExclusive: string } {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  return {
    start: startDate.toISOString().slice(0, 10),
    endExclusive: endDate.toISOString().slice(0, 10),
  };
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function sumBy<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((acc, item) => acc + fn(item), 0);
}

export async function getMonthlyStatement(params: {
  month?: string;
  customerId?: string;
}): Promise<MonthlyStatementResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  const supabase = createAdminClient();
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonthKey();
  const { start, endExclusive } = monthStartAndEnd(month);

  const customersResult = await supabase
    .from("customers")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (customersResult.error) {
    return { ok: false, code: "db_error", message: customersResult.error.message };
  }

  const customers = (customersResult.data ?? []) as ArCustomerOption[];
  const selectedCustomerId =
    params.customerId && customers.some((c) => c.id === params.customerId)
      ? params.customerId
      : (customers[0]?.id ?? "");

  if (!selectedCustomerId) {
    return {
      ok: true,
      month,
      customers,
      selectedCustomerId: "",
      selectedCustomerName: "",
      summary: {
        openingBalance: 0,
        periodInvoiced: 0,
        periodPaid: 0,
        closingBalance: 0,
      },
      aging: {
        current: 0,
        bucket0To30: 0,
        bucket31To60: 0,
        bucket61To90: 0,
        bucket90Plus: 0,
        totalOutstanding: 0,
      },
      invoices: [],
      receivableInvoices: [],
    };
  }

  const selectedCustomerName = customers.find((c) => c.id === selectedCustomerId)?.name ?? "";

  const [allInvoicesResult, periodInvoicesResult, receiptsResult, receivableInvoicesResult] =
    await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id, invoice_date, total_amount, status")
      .eq("customer_id", selectedCustomerId)
      .neq("status", "cancelled"),
    supabase
      .from("sales_invoice_ar")
      .select("id, invoice_no, invoice_date, total_amount, amount_paid, balance_due, status")
      .eq("customer_id", selectedCustomerId)
      .gte("invoice_date", start)
      .lt("invoice_date", endExclusive)
      .order("invoice_date", { ascending: true }),
    supabase
      .from("payment_receipts")
      .select("amount, received_at, sales_invoices!inner(customer_id, status)")
      .eq("sales_invoices.customer_id", selectedCustomerId)
      .neq("sales_invoices.status", "cancelled"),
    supabase
      .from("sales_invoice_ar")
      .select("id, invoice_no, invoice_date, balance_due")
      .eq("customer_id", selectedCustomerId)
      .gt("balance_due", 0)
      .order("invoice_date", { ascending: true }),
    ]);

  if (allInvoicesResult.error) {
    return { ok: false, code: "db_error", message: allInvoicesResult.error.message };
  }
  if (periodInvoicesResult.error) {
    return { ok: false, code: "db_error", message: periodInvoicesResult.error.message };
  }
  if (receiptsResult.error) {
    return { ok: false, code: "db_error", message: receiptsResult.error.message };
  }
  if (receivableInvoicesResult.error) {
    return { ok: false, code: "db_error", message: receivableInvoicesResult.error.message };
  }

  const allInvoices = allInvoicesResult.data ?? [];
  const periodInvoiced = sumBy(
    allInvoices.filter((invoice) => invoice.invoice_date >= start && invoice.invoice_date < endExclusive),
    (invoice) => Number(invoice.total_amount ?? 0),
  );
  const openingInvoiced = sumBy(
    allInvoices.filter((invoice) => invoice.invoice_date < start),
    (invoice) => Number(invoice.total_amount ?? 0),
  );

  const receipts = receiptsResult.data ?? [];
  const periodPaid = sumBy(
    receipts.filter((receipt) => {
      const receivedDate = String(receipt.received_at).slice(0, 10);
      return receivedDate >= start && receivedDate < endExclusive;
    }),
    (receipt) => Number(receipt.amount ?? 0),
  );
  const openingPaid = sumBy(
    receipts.filter((receipt) => String(receipt.received_at).slice(0, 10) < start),
    (receipt) => Number(receipt.amount ?? 0),
  );

  const openingBalance = openingInvoiced - openingPaid;
  const closingBalance = openingBalance + periodInvoiced - periodPaid;

  const asOfDate = new Date(`${endExclusive}T00:00:00Z`);
  asOfDate.setUTCDate(asOfDate.getUTCDate() - 1);

  const aging: ArAgingSummary = {
    current: 0,
    bucket0To30: 0,
    bucket31To60: 0,
    bucket61To90: 0,
    bucket90Plus: 0,
    totalOutstanding: 0,
  };

  const receivableInvoices = (receivableInvoicesResult.data ?? []) as ReceivableInvoiceOption[];
  for (const invoice of receivableInvoices) {
    const balance = Number(invoice.balance_due ?? 0);
    if (balance <= 0) continue;

    const invoiceDate = new Date(`${invoice.invoice_date}T00:00:00Z`);
    const dayDiff = Math.floor(
      (asOfDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (dayDiff < 0) {
      aging.current += balance;
    } else if (dayDiff <= 30) {
      aging.bucket0To30 += balance;
    } else if (dayDiff <= 60) {
      aging.bucket31To60 += balance;
    } else if (dayDiff <= 90) {
      aging.bucket61To90 += balance;
    } else {
      aging.bucket90Plus += balance;
    }
    aging.totalOutstanding += balance;
  }

  return {
    ok: true,
    month,
    customers,
    selectedCustomerId,
    selectedCustomerName,
    summary: {
      openingBalance,
      periodInvoiced,
      periodPaid,
      closingBalance,
    },
    aging,
    invoices: (periodInvoicesResult.data ?? []) as MonthlyInvoiceRow[],
    receivableInvoices,
  };
}

function toNumber(input: FormDataEntryValue | null): number {
  const value = Number(String(input ?? "").trim());
  if (!Number.isFinite(value)) {
    throw new TypeError("請輸入有效金額");
  }
  return value;
}

export async function addPaymentReceipt(
  _prev: AddReceiptState,
  formData: FormData,
): Promise<AddReceiptState> {
  try {
    await requireRole(["owner", "accountant", "manager"]);
  } catch {
    return { ok: false, message: "你無權限登記收款" };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "請先在 .env.local 設定 Supabase" };
  }

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const method = String(formData.get("method") ?? "cash").trim();
  const referenceNo = String(formData.get("reference_no") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const receivedDate = String(formData.get("received_date") ?? "").trim();
  const month = String(formData.get("month") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();

  if (!invoiceId) {
    return { ok: false, message: "請選擇發票" };
  }

  let amount = 0;
  try {
    amount = toNumber(formData.get("amount"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "請輸入有效金額";
    return { ok: false, message };
  }
  if (amount <= 0) {
    return { ok: false, message: "收款金額必須大於 0" };
  }

  const supabase = createAdminClient();
  const { data: arRow, error: arError } = await supabase
    .from("sales_invoice_ar")
    .select("id, invoice_no, balance_due")
    .eq("id", invoiceId)
    .single();
  if (arError || !arRow) {
    return { ok: false, message: arError?.message ?? "找不到發票或發票已作廢" };
  }
  if (amount > Number(arRow.balance_due)) {
    return {
      ok: false,
      message: `收款金額不可大於未收餘額（${Number(arRow.balance_due).toFixed(2)}）`,
    };
  }

  const { error: insertError } = await supabase.from("payment_receipts").insert({
    invoice_id: invoiceId,
    amount,
    method,
    reference_no: referenceNo,
    notes,
    received_at: receivedDate ? `${receivedDate}T12:00:00+08:00` : new Date().toISOString(),
  });

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  void month;
  void customerId;
  revalidatePath("/sales/ar");
  return { ok: true, message: `已登記收款（發票 ${arRow.invoice_no}）` };
}
