import { AddProductForm } from "@/components/products/add-product-form";
import { ToggleProductActiveButton } from "@/components/products/toggle-product-active-button";
import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { getProductsResult } from "./actions";

function pricingMethodLabel(method: string): string {
  const map: Record<string, string> = {
    per_piece: "按件",
    per_weight: "按重量",
  };
  return map[method] ?? method;
}

function unitLabel(unit: string): string {
  const map: Record<string, string> = {
    kg: "kg",
    catty: "司馬斤",
    jin: "斤",
    piece: "件",
  };
  return map[unit] ?? unit;
}

export default async function ProductsPage() {
  const result = await getProductsResult();

  if (result.ok === false && result.code === "not_configured") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">產品</h1>
          <p className="text-muted-foreground text-sm">
            計件／計重、斤／司馬斤／公斤等主檔。請先完成下方設定。
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
          <h1 className="text-2xl font-semibold tracking-tight">產品</h1>
          <p className="text-destructive text-sm">
            資料庫錯誤：{result.message}（請先確認 migration 已執行）
          </p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  const products = result.ok ? result.products : [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">產品</h1>
        <p className="text-muted-foreground text-sm">
          最小可用版：產品列表、基本新增、啟用/停用。
        </p>
      </div>

      <AddProductForm />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">產品列表</h2>
        {products.length === 0 ? (
          <p className="text-muted-foreground text-sm">暫無資料，請用上方表單新增。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">名稱</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">規格</th>
                  <th className="px-3 py-2 font-medium">計價方式</th>
                  <th className="px-3 py-2 font-medium">銷售單位</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{product.name}</td>
                    <td className="text-muted-foreground px-3 py-2">{product.sku ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">{product.spec ?? "—"}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {pricingMethodLabel(product.pricing_method)}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {unitLabel(product.sale_unit)}
                    </td>
                    <td className="px-3 py-2">
                      {product.is_active ? (
                        <span className="text-emerald-300">啟用中</span>
                      ) : (
                        <span className="text-muted-foreground">已停用</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ToggleProductActiveButton
                        productId={product.id}
                        isActive={product.is_active}
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
