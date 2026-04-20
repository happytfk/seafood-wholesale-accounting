import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { AddPaymentReceiptForm } from "@/components/sales/add-payment-receipt-form";
import { MonthlyStatementFilter } from "@/components/sales/monthly-statement-filter";
import Link from "next/link";
import { getMonthlyStatement } from "./actions";

type SearchParams = Promise<{
  month?: string;
  customerId?: string;
}>;

function money(value: number): string {
  return `HKD ${value.toFixed(2)}`;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "未收",
    partial: "部份收款",
    paid: "已收妥",
    draft: "草稿",
    confirmed: "已確認",
    cancelled: "已作廢",
  };
  return map[status] ?? status;
}

export default async function AccountsReceivablePage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const result = await getMonthlyStatement({
    month: searchParams.month,
    customerId: searchParams.customerId,
  });

  if (result.ok === false && result.code === "not_configured") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">月結單（AR）</h1>
          <p className="text-muted-foreground text-sm">
            依客戶與月份顯示期初、開票、收款、期末結餘。
          </p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  if (result.ok === false && result.code === "db_error") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">月結單（AR）</h1>
          <p className="text-destructive text-sm">
            資料庫錯誤：{result.message}（請先確認 migration 已執行）
          </p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  const invoices = result.ok ? result.invoices : [];
  const receivableInvoices = result.ok ? result.receivableInvoices : [];
  const aging = result.ok
    ? result.aging
    : {
        current: 0,
        bucket0To30: 0,
        bucket31To60: 0,
        bucket61To90: 0,
        bucket90Plus: 0,
        totalOutstanding: 0,
      };
  const summary = result.ok
    ? result.summary
    : { openingBalance: 0, periodInvoiced: 0, periodPaid: 0, closingBalance: 0 };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">月結單（AR）</h1>
        <p className="text-muted-foreground text-sm">
          客戶：{result.selectedCustomerName || "—"}；月份：{result.month}
        </p>
      </div>

      <MonthlyStatementFilter
        month={result.month}
        customerId={result.selectedCustomerId}
        customers={result.customers}
      />
      {result.selectedCustomerId ? (
        <div>
          <Link
            href={`/sales/ar/export?month=${encodeURIComponent(result.month)}&customerId=${encodeURIComponent(
              result.selectedCustomerId,
            )}`}
            className="text-primary text-xs underline-offset-4 hover:underline"
          >
            匯出月結 CSV
          </Link>
        </div>
      ) : null}

      {result.selectedCustomerId ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-xs">期初結餘</p>
              <p className="text-lg font-semibold">{money(summary.openingBalance)}</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-xs">本月開票</p>
              <p className="text-lg font-semibold">{money(summary.periodInvoiced)}</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-xs">本月收款</p>
              <p className="text-lg font-semibold">{money(summary.periodPaid)}</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-xs">期末結餘</p>
              <p className="text-lg font-semibold">{money(summary.closingBalance)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium">應收帳齡（Aging）</h2>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="bg-card rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">當期 / 未到期</p>
                <p className="text-lg font-semibold">{money(aging.current)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">0-30 日</p>
                <p className="text-lg font-semibold">{money(aging.bucket0To30)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">31-60 日</p>
                <p className="text-lg font-semibold">{money(aging.bucket31To60)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">61-90 日</p>
                <p className="text-lg font-semibold">{money(aging.bucket61To90)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">90+ 日</p>
                <p className="text-lg font-semibold">{money(aging.bucket90Plus)}</p>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              應收總額：<span className="text-foreground font-medium">{money(aging.totalOutstanding)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium">收款登記</h2>
            {receivableInvoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">目前無可收款發票（可能已全部收妥）。</p>
            ) : (
              <AddPaymentReceiptForm
                month={result.month}
                customerId={result.selectedCustomerId}
                receivableInvoices={receivableInvoices}
              />
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium">本月發票明細</h2>
            {invoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">本月無發票資料。</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/50 border-b text-xs">
                    <tr>
                      <th className="px-3 py-2 font-medium">日期</th>
                      <th className="px-3 py-2 font-medium">發票號</th>
                      <th className="px-3 py-2 font-medium">狀態</th>
                      <th className="px-3 py-2 font-medium">發票總額</th>
                      <th className="px-3 py-2 font-medium">已收金額</th>
                      <th className="px-3 py-2 font-medium">未收餘額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b last:border-0">
                        <td className="text-muted-foreground px-3 py-2">{invoice.invoice_date}</td>
                        <td className="px-3 py-2 font-medium">{invoice.invoice_no}</td>
                        <td className="text-muted-foreground px-3 py-2">
                          {statusLabel(invoice.status)}
                        </td>
                        <td className="px-3 py-2">{money(Number(invoice.total_amount))}</td>
                        <td className="px-3 py-2">{money(Number(invoice.amount_paid))}</td>
                        <td className="px-3 py-2 font-medium">
                          {money(Number(invoice.balance_due))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">請先建立客戶，先可查看月結單。</p>
      )}
    </div>
  );
}
