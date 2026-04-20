import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getMonthlyStatement } from "../actions";

function escapeCsv(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(values: Array<string | number>): string {
  return values.map(escapeCsv).join(",");
}

export async function GET(request: Request) {
  try {
    await requireRole(["owner", "accountant", "manager"]);
  } catch {
    return NextResponse.json({ error: "你無權限匯出月結單" }, { status: 403 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? undefined;
  const customerId = url.searchParams.get("customerId") ?? undefined;

  const result = await getMonthlyStatement({ month, customerId });
  if (!result.ok) {
    const message =
      result.code === "not_configured" ? "尚未設定 Supabase" : result.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const lines: string[] = [];
  lines.push(csvRow(["月結單匯出"]));
  lines.push(csvRow(["客戶", result.selectedCustomerName || "—"]));
  lines.push(csvRow(["月份", result.month]));
  lines.push("");

  lines.push(csvRow(["摘要", "金額(HKD)"]));
  lines.push(csvRow(["期初結餘", result.summary.openingBalance.toFixed(2)]));
  lines.push(csvRow(["本月開票", result.summary.periodInvoiced.toFixed(2)]));
  lines.push(csvRow(["本月收款", result.summary.periodPaid.toFixed(2)]));
  lines.push(csvRow(["期末結餘", result.summary.closingBalance.toFixed(2)]));
  lines.push("");

  lines.push(csvRow(["帳齡", "金額(HKD)"]));
  lines.push(csvRow(["當期/未到期", result.aging.current.toFixed(2)]));
  lines.push(csvRow(["0-30日", result.aging.bucket0To30.toFixed(2)]));
  lines.push(csvRow(["31-60日", result.aging.bucket31To60.toFixed(2)]));
  lines.push(csvRow(["61-90日", result.aging.bucket61To90.toFixed(2)]));
  lines.push(csvRow(["90+日", result.aging.bucket90Plus.toFixed(2)]));
  lines.push(csvRow(["應收總額", result.aging.totalOutstanding.toFixed(2)]));
  lines.push("");

  lines.push(
    csvRow(["本月發票明細", "日期", "發票號", "狀態", "發票總額", "已收金額", "未收餘額"]),
  );
  for (const invoice of result.invoices) {
    lines.push(
      csvRow([
        "",
        invoice.invoice_date,
        invoice.invoice_no,
        invoice.status,
        Number(invoice.total_amount).toFixed(2),
        Number(invoice.amount_paid).toFixed(2),
        Number(invoice.balance_due).toFixed(2),
      ]),
    );
  }

  const csv = `\uFEFF${lines.join("\n")}`;
  const fileName = `ar-statement-${result.month}-${result.selectedCustomerName || "customer"}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
