import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { AddSupplierForm } from "@/components/suppliers/add-supplier-form";
import { ToggleSupplierActiveButton } from "@/components/suppliers/toggle-supplier-active-button";
import { getSuppliersResult } from "./actions";

export default async function SuppliersPage() {
  const result = await getSuppliersResult();

  if (result.ok === false && result.code === "not_configured") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">供應商</h1>
          <p className="text-muted-foreground text-sm">供應商主檔與入貨來源。請先完成下方設定。</p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  if (result.ok === false && result.code === "db_error") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">供應商</h1>
          <p className="text-destructive text-sm">
            資料庫錯誤：{result.message}（請先確認 migration 已執行）
          </p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  const suppliers = result.ok ? result.suppliers : [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">供應商</h1>
        <p className="text-muted-foreground text-sm">
          最小可用版：供應商列表、基本新增、啟用/停用。
        </p>
      </div>

      <AddSupplierForm />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">供應商列表</h2>
        {suppliers.length === 0 ? (
          <p className="text-muted-foreground text-sm">暫無資料，請用上方表單新增。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">名稱</th>
                  <th className="px-3 py-2 font-medium">代碼</th>
                  <th className="px-3 py-2 font-medium">電話</th>
                  <th className="px-3 py-2 font-medium">地址</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{supplier.name}</td>
                    <td className="text-muted-foreground px-3 py-2">{supplier.code ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">{supplier.phone ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">{supplier.address ?? "—"}</td>
                    <td className="px-3 py-2">
                      {supplier.is_active ? (
                        <span className="text-emerald-300">啟用中</span>
                      ) : (
                        <span className="text-muted-foreground">已停用</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ToggleSupplierActiveButton
                        supplierId={supplier.id}
                        isActive={supplier.is_active}
                      />
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
