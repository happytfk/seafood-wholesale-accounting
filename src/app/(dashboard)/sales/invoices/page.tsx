import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { CreateInvoiceForm } from "@/components/sales/create-invoice-form";
import { InvoiceStatusActions } from "@/components/sales/invoice-status-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getInvoicePageData } from "./actions";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
}>;

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "草稿",
    confirmed: "已確認",
    cancelled: "已作廢",
  };
  return map[status] ?? status;
}

export default async function SalesInvoicesPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const result = await getInvoicePageData({
    q: searchParams.q,
    status: searchParams.status,
    customerId: searchParams.customerId,
    fromDate: searchParams.fromDate,
    toDate: searchParams.toDate,
  });

  if (result.ok === false && result.code === "not_configured") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">銷售開單</h1>
          <p className="text-muted-foreground text-sm">
            開單時請填毛重、籃重（皮重）與扣水份，淨重會用統一公式計算。
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
          <h1 className="text-2xl font-semibold tracking-tight">銷售開單</h1>
          <p className="text-destructive text-sm">
            資料庫錯誤：{result.message}（請先確認 migration 已執行）
          </p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  const customers = result.ok ? result.customers : [];
  const products = result.ok ? result.products : [];
  const invoices = result.ok ? result.invoices : [];
  const filters = result.ok
    ? result.filters
    : {
        q: "",
        status: "all" as const,
        customerId: "",
        fromDate: "",
        toDate: "",
      };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">銷售開單</h1>
        <p className="text-muted-foreground text-sm">
          第二版支援多行明細：同一張發票可加入多個產品，並逐行計算淨重與金額。
        </p>
      </div>

      {customers.length === 0 || products.length === 0 ? (
        <div className="bg-card text-card-foreground space-y-2 rounded-xl border border-amber-500/40 p-4 text-sm">
          <p className="font-medium text-amber-200">未能開單：缺少基礎資料</p>
          <p className="text-muted-foreground">
            {customers.length === 0 ? "請先建立客戶。" : ""}
            {customers.length === 0 && products.length === 0 ? " " : ""}
            {products.length === 0 ? "請先於資料庫新增產品。" : ""}
          </p>
        </div>
      ) : (
        <CreateInvoiceForm customers={customers} products={products} />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">發票列表（可搜尋/篩選）</h2>
          <p className="text-muted-foreground text-xs">最多顯示 50 筆</p>
        </div>
        <form
          method="get"
          className="bg-card grid gap-3 rounded-xl border p-4 md:grid-cols-6 md:items-end"
        >
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="q" className="text-muted-foreground text-xs font-medium">
              搜尋（發票號 / 客戶）
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={filters.q}
              placeholder="例如 SI-20260420"
              className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-muted-foreground text-xs font-medium">
              狀態
            </label>
            <select
              id="status"
              name="status"
              defaultValue={filters.status}
              className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            >
              <option value="all">全部</option>
              <option value="draft">草稿</option>
              <option value="confirmed">已確認</option>
              <option value="cancelled">已作廢</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="customerId" className="text-muted-foreground text-xs font-medium">
              客戶
            </label>
            <select
              id="customerId"
              name="customerId"
              defaultValue={filters.customerId}
              className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            >
              <option value="">全部客戶</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="fromDate" className="text-muted-foreground text-xs font-medium">
              由
            </label>
            <input
              id="fromDate"
              name="fromDate"
              type="date"
              defaultValue={filters.fromDate}
              className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="toDate" className="text-muted-foreground text-xs font-medium">
              到
            </label>
            <input
              id="toDate"
              name="toDate"
              type="date"
              defaultValue={filters.toDate}
              className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            />
          </div>
          <div className="md:col-span-6 flex gap-2">
            <Button type="submit" size="sm">
              套用篩選
            </Button>
            <Link
              href="/sales/invoices"
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
            >
              清除
            </Link>
          </div>
        </form>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">無符合條件發票（可調整搜尋/篩選條件）。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">發票號</th>
                  <th className="px-3 py-2 font-medium">日期</th>
                  <th className="px-3 py-2 font-medium">客戶</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium">總額</th>
                  <th className="px-3 py-2 font-medium">流程</th>
                  <th className="px-3 py-2 font-medium">列印</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{invoice.invoice_no}</td>
                    <td className="text-muted-foreground px-3 py-2">{invoice.invoice_date}</td>
                    <td className="px-3 py-2">{invoice.customer_name}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {statusLabel(invoice.status)}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      HKD {Number(invoice.total_amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <InvoiceStatusActions invoiceId={invoice.id} status={invoice.status} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/sales/invoices/${invoice.id}/print`}
                        className="text-primary text-xs underline-offset-4 hover:underline"
                      >
                        開啟列印版
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
