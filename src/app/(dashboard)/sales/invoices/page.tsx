import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { CreateInvoiceForm } from "@/components/sales/create-invoice-form";
import { getInvoicePageData } from "./actions";

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "草稿",
    confirmed: "已確認",
    cancelled: "已作廢",
  };
  return map[status] ?? status;
}

export default async function SalesInvoicesPage() {
  const result = await getInvoicePageData();

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
        <h2 className="text-sm font-medium">最近發票</h2>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">暫未有發票，請先用上方表單建立草稿發票。</p>
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
