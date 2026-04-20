import { AddCustomerForm } from "@/components/customers/add-customer-form";
import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { getCustomersResult } from "./actions";

function segmentLabel(segment: string): string {
  const map: Record<string, string> = {
    restaurant: "酒樓／餐飲",
    wet_market: "街市零售商",
    processor: "加工／二批",
    retail_other: "其他零售",
    other: "其他",
  };
  return map[segment] ?? segment;
}

export default async function CustomersPage() {
  const result = await getCustomersResult();

  if (result.ok === false && result.code === "not_configured") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">客戶</h1>
          <p className="text-muted-foreground text-sm">
            酒樓、街市等分類與折扣等級。請先完成下方設定即可新增與列表。
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
          <h1 className="text-2xl font-semibold tracking-tight">客戶</h1>
          <p className="text-destructive text-sm">
            資料庫錯誤：{result.message}（多數係未執行 migration，或表名不符）
          </p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  const customers = result.ok ? result.customers : [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">客戶</h1>
        <p className="text-muted-foreground text-sm">酒樓、街市等分類與折扣等級。</p>
      </div>

      <AddCustomerForm />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">客戶列表</h2>
        {customers.length === 0 ? (
          <p className="text-muted-foreground text-sm">暫無資料，請用上方表單新增。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">名稱</th>
                  <th className="px-3 py-2 font-medium">類型</th>
                  <th className="px-3 py-2 font-medium">電話</th>
                  <th className="px-3 py-2 font-medium">付款條件</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {segmentLabel(c.segment)}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{c.phone ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">{c.payment_term}</td>
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
