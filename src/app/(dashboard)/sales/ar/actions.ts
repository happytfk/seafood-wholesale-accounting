"use server";

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

export type MonthlyStatementResult =
  | {
      ok: true;
      month: string;
      customers: ArCustomerOption[];
      selectedCustomerId: string;
      selectedCustomerName: string;
      summary: MonthlyStatementSummary;
      invoices: MonthlyInvoiceRow[];
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
      invoices: [],
    };
  }

  const selectedCustomerName = customers.find((c) => c.id === selectedCustomerId)?.name ?? "";

  const [allInvoicesResult, periodInvoicesResult, receiptsResult] = await Promise.all([
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
    invoices: (periodInvoicesResult.data ?? []) as MonthlyInvoiceRow[],
  };
}
