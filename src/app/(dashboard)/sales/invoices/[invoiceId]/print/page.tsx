import { notFound } from "next/navigation";
import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { InvoicePrintActions } from "@/components/sales/invoice-print-actions";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{ invoiceId: string }>;
};

function money(value: number): string {
  return `HKD ${value.toFixed(2)}`;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "草稿",
    confirmed: "已確認",
    cancelled: "已作廢",
  };
  return map[status] ?? status;
}

export default async function InvoicePrintPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">發票列印</h1>
          <p className="text-muted-foreground text-sm">請先設定 Supabase，才可讀取發票資料。</p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  const { invoiceId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_invoices")
    .select(
      "id, invoice_no, invoice_date, status, subtotal, total_amount, amount_paid, payment_term, notes, customers(name, phone, address), sales_invoice_lines(id, line_no, name, spec, unit, unit_price, gross_weight, basket_weight, moisture_deduction, net_weight, line_total)",
    )
    .eq("id", invoiceId)
    .single();

  if (error || !data) {
    notFound();
  }

  const customerCell = data.customers as
    | { name: string; phone: string | null; address: string | null }
    | { name: string; phone: string | null; address: string | null }[]
    | null;
  const customer = Array.isArray(customerCell) ? customerCell[0] : customerCell;

  const lines = ((data.sales_invoice_lines ?? []) as Array<{
    id: string;
    line_no: number;
    name: string;
    spec: string | null;
    unit: string;
    unit_price: number;
    gross_weight: number | null;
    basket_weight: number | null;
    moisture_deduction: number | null;
    net_weight: number;
    line_total: number;
  }>).sort((a, b) => a.line_no - b.line_no);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6 print:max-w-none print:p-0">
      <InvoicePrintActions />

      <section className="bg-card rounded-xl border p-6 print:rounded-none print:border-0 print:p-0">
        <div className="mb-6 flex items-start justify-between gap-6 border-b pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">海鮮批發銷售發票</h1>
            <p className="text-muted-foreground text-sm">列印版（A4 / PDF）</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{data.invoice_no}</p>
            <p className="text-muted-foreground">日期：{data.invoice_date}</p>
            <p className="text-muted-foreground">狀態：{statusLabel(data.status)}</p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 border-b pb-4 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">客戶</p>
            <p className="font-medium">{customer?.name ?? "—"}</p>
            <p className="text-muted-foreground">{customer?.phone ?? "—"}</p>
            <p className="text-muted-foreground">{customer?.address ?? "—"}</p>
          </div>
          <div className="space-y-1 md:text-right">
            <p className="text-muted-foreground text-xs">付款條件</p>
            <p className="font-medium">{data.payment_term}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/50 border-y text-xs">
              <tr>
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">貨品</th>
                <th className="px-2 py-2 font-medium">規格</th>
                <th className="px-2 py-2 font-medium">毛重</th>
                <th className="px-2 py-2 font-medium">籃重</th>
                <th className="px-2 py-2 font-medium">扣水份</th>
                <th className="px-2 py-2 font-medium">淨重</th>
                <th className="px-2 py-2 font-medium">單位</th>
                <th className="px-2 py-2 font-medium">單價</th>
                <th className="px-2 py-2 font-medium">小計</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="px-2 py-2">{line.line_no}</td>
                  <td className="px-2 py-2 font-medium">{line.name}</td>
                  <td className="text-muted-foreground px-2 py-2">{line.spec ?? "—"}</td>
                  <td className="px-2 py-2">{Number(line.gross_weight ?? 0).toFixed(3)}</td>
                  <td className="px-2 py-2">{Number(line.basket_weight ?? 0).toFixed(3)}</td>
                  <td className="px-2 py-2">{Number(line.moisture_deduction ?? 0).toFixed(3)}</td>
                  <td className="px-2 py-2">{Number(line.net_weight).toFixed(3)}</td>
                  <td className="px-2 py-2">{line.unit}</td>
                  <td className="px-2 py-2">{money(Number(line.unit_price))}</td>
                  <td className="px-2 py-2 font-medium">{money(Number(line.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 ml-auto max-w-sm space-y-2 border-t pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">小計</span>
            <span>{money(Number(data.subtotal ?? 0))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">已收款</span>
            <span>{money(Number(data.amount_paid ?? 0))}</span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold">
            <span>總額</span>
            <span>{money(Number(data.total_amount ?? 0))}</span>
          </div>
        </div>

        {data.notes ? (
          <div className="mt-6 border-t pt-4 text-sm">
            <p className="text-muted-foreground mb-1 text-xs">備註</p>
            <p>{data.notes}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
