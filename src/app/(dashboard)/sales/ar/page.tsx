import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { MonthlyStatementFilter } from "@/components/sales/monthly-statement-filter";
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
