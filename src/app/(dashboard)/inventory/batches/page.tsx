import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { AddInventoryBatchForm } from "@/components/inventory/add-inventory-batch-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getBatchesPageData } from "./actions";

type SearchParams = Promise<{
  productId?: string;
  supplierId?: string;
  onlyOpen?: string;
}>;

function money(value: number): string {
  return `HKD ${value.toFixed(2)}`;
}

export default async function InventoryBatchesPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const result = await getBatchesPageData({
    productId: searchParams.productId,
    supplierId: searchParams.supplierId,
    onlyOpen: searchParams.onlyOpen,
  });

  if (result.ok === false && result.code === "not_configured") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">入庫批次</h1>
          <p className="text-muted-foreground text-sm">
            每批貨來源、入貨價、即時剩餘庫存。
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
          <h1 className="text-2xl font-semibold tracking-tight">入庫批次</h1>
          <p className="text-destructive text-sm">資料庫錯誤：{result.message}</p>
        </div>
      </div>
    );
  }

  const { suppliers, products, batches, summary, filters } = result;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">入庫批次</h1>
        <p className="text-muted-foreground text-sm">每批貨來源、入貨價、即時剩餘庫存。</p>
      </div>

      {suppliers.length === 0 || products.length === 0 ? (
        <div className="bg-card text-card-foreground space-y-2 rounded-xl border border-amber-500/40 p-4 text-sm">
          <p className="font-medium text-amber-200">未能新增批次：缺少基礎資料</p>
          <p className="text-muted-foreground">
            {suppliers.length === 0 ? "請先建立供應商。" : ""}
            {suppliers.length === 0 && products.length === 0 ? " " : ""}
            {products.length === 0 ? "請先建立產品。" : ""}
          </p>
        </div>
      ) : (
        <AddInventoryBatchForm suppliers={suppliers} products={products} />
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">批次總數（目前結果）</p>
          <p className="text-lg font-semibold">{summary.totalBatches}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">尚有庫存批次</p>
          <p className="text-lg font-semibold">{summary.openBatches}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">已耗盡批次</p>
          <p className="text-lg font-semibold">{summary.depletedBatches}</p>
        </div>
      </div>

      <form method="get" className="bg-card grid gap-3 rounded-xl border p-4 md:grid-cols-4 md:items-end">
        <div className="space-y-1.5">
          <label htmlFor="productId" className="text-muted-foreground text-xs font-medium">
            產品
          </label>
          <select
            id="productId"
            name="productId"
            defaultValue={filters.productId}
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
          >
            <option value="">全部產品</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="supplierId" className="text-muted-foreground text-xs font-medium">
            供應商
          </label>
          <select
            id="supplierId"
            name="supplierId"
            defaultValue={filters.supplierId}
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
          >
            <option value="">全部供應商</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="onlyOpen"
            name="onlyOpen"
            type="checkbox"
            value="1"
            defaultChecked={filters.onlyOpen}
            className="border-input h-4 w-4 rounded"
          />
          <label htmlFor="onlyOpen" className="text-muted-foreground text-xs font-medium">
            只顯示有餘量批次
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            套用篩選
          </Button>
          <Link
            href="/inventory/batches"
            className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
          >
            清除
          </Link>
          <Link
            href={`/inventory/batches/export?productId=${encodeURIComponent(filters.productId)}&supplierId=${encodeURIComponent(filters.supplierId)}&onlyOpen=${filters.onlyOpen ? "1" : ""}`}
            className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
          >
            匯出 CSV
          </Link>
        </div>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">批次清單（最多 100 筆）</h2>
        {batches.length === 0 ? (
          <p className="text-muted-foreground text-sm">無符合條件批次。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">日期</th>
                  <th className="px-3 py-2 font-medium">批次號</th>
                  <th className="px-3 py-2 font-medium">供應商</th>
                  <th className="px-3 py-2 font-medium">產品</th>
                  <th className="px-3 py-2 font-medium">收貨數量</th>
                  <th className="px-3 py-2 font-medium">剩餘數量</th>
                  <th className="px-3 py-2 font-medium">單位成本</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const lowStock = batch.quantity_remaining > 0 && batch.quantity_remaining <= 5;
                  const depleted = batch.quantity_remaining <= 0;
                  return (
                    <tr key={batch.id} className="border-b last:border-0">
                      <td className="text-muted-foreground px-3 py-2">{batch.received_at}</td>
                      <td className="px-3 py-2 font-medium">{batch.batch_code || "—"}</td>
                      <td className="px-3 py-2">{batch.supplier_name}</td>
                      <td className="px-3 py-2">
                        {batch.product_name}
                        {batch.product_spec ? (
                          <span className="text-muted-foreground text-xs">（{batch.product_spec}）</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {batch.quantity_received.toFixed(3)} {batch.unit}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {batch.quantity_remaining.toFixed(3)} {batch.unit}
                      </td>
                      <td className="px-3 py-2">{money(batch.unit_cost)}</td>
                      <td className="px-3 py-2">
                        {depleted ? (
                          <span className="text-muted-foreground text-xs">已耗盡</span>
                        ) : lowStock ? (
                          <span className="text-amber-300 text-xs">低庫存</span>
                        ) : (
                          <span className="text-emerald-300 text-xs">正常</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
