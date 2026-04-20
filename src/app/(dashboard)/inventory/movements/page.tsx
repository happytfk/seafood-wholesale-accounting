import { SupabaseSetupHint } from "@/components/customers/supabase-setup-hint";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getMovementsPageData } from "./actions";

type SearchParams = Promise<{
  productId?: string;
  movementType?: string;
  fromDate?: string;
  toDate?: string;
  page?: string;
}>;

function movementTypeLabel(type: string): string {
  const map: Record<string, string> = {
    purchase_in: "入庫",
    sale_out: "銷貨扣減",
    adjustment: "調整",
    transfer: "調撥",
    wastage: "損耗",
  };
  return map[type] ?? type;
}

function fmtDateTime(isoText: string): string {
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return isoText;
  return date.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hrefWithPage(baseParams: URLSearchParams, page: number): string {
  const params = new URLSearchParams(baseParams);
  params.set("page", String(page));
  return `/inventory/movements?${params.toString()}`;
}

export default async function InventoryMovementsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const result = await getMovementsPageData({
    productId: searchParams.productId,
    movementType: searchParams.movementType,
    fromDate: searchParams.fromDate,
    toDate: searchParams.toDate,
    page: searchParams.page,
  });

  if (result.ok === false && result.code === "not_configured") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">庫存異動</h1>
          <p className="text-muted-foreground text-sm">調整、銷貨扣庫、入庫等流水紀錄。</p>
        </div>
        <SupabaseSetupHint />
      </div>
    );
  }

  if (result.ok === false && result.code === "db_error") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">庫存異動</h1>
          <p className="text-destructive text-sm">資料庫錯誤：{result.message}</p>
        </div>
      </div>
    );
  }

  const { products, movements, filters, pagination } = result;
  const baseParams = new URLSearchParams();
  if (filters.productId) baseParams.set("productId", filters.productId);
  if (filters.movementType && filters.movementType !== "all") {
    baseParams.set("movementType", filters.movementType);
  }
  if (filters.fromDate) baseParams.set("fromDate", filters.fromDate);
  if (filters.toDate) baseParams.set("toDate", filters.toDate);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">庫存異動</h1>
        <p className="text-muted-foreground text-sm">調整、銷貨扣庫、入庫等流水紀錄。</p>
      </div>

      <form method="get" className="bg-card grid gap-3 rounded-xl border p-4 md:grid-cols-5 md:items-end">
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
          <label htmlFor="movementType" className="text-muted-foreground text-xs font-medium">
            異動類型
          </label>
          <select
            id="movementType"
            name="movementType"
            defaultValue={filters.movementType}
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
          >
            <option value="all">全部類型</option>
            <option value="purchase_in">入庫</option>
            <option value="sale_out">銷貨扣減</option>
            <option value="adjustment">調整</option>
            <option value="transfer">調撥</option>
            <option value="wastage">損耗</option>
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

        <div className="flex gap-2">
          <Button type="submit" size="sm">
            套用篩選
          </Button>
          <Link
            href="/inventory/movements"
            className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
          >
            清除
          </Link>
          <Link
            href={`/inventory/movements/export?productId=${encodeURIComponent(filters.productId)}&movementType=${encodeURIComponent(filters.movementType)}&fromDate=${encodeURIComponent(filters.fromDate)}&toDate=${encodeURIComponent(filters.toDate)}`}
            className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
          >
            匯出 CSV
          </Link>
        </div>
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">異動清單</h2>
          <p className="text-muted-foreground text-xs">
            第 {pagination.page} / {pagination.totalPages} 頁，共 {pagination.totalCount} 筆
          </p>
        </div>
        {movements.length === 0 ? (
          <p className="text-muted-foreground text-sm">無符合條件的庫存異動。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">時間</th>
                  <th className="px-3 py-2 font-medium">類型</th>
                  <th className="px-3 py-2 font-medium">產品</th>
                  <th className="px-3 py-2 font-medium">批次</th>
                  <th className="px-3 py-2 font-medium">數量變化</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">備註</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-b last:border-0">
                    <td className="text-muted-foreground px-3 py-2">{fmtDateTime(movement.created_at)}</td>
                    <td className="px-3 py-2">{movementTypeLabel(movement.movement_type)}</td>
                    <td className="px-3 py-2">{movement.product_name}</td>
                    <td className="px-3 py-2">{movement.batch_code || "—"}</td>
                    <td className="px-3 py-2 font-medium">
                      {movement.quantity_delta >= 0 ? "+" : ""}
                      {movement.quantity_delta.toFixed(3)} {movement.unit}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {movement.reference_table && movement.reference_id
                        ? `${movement.reference_table} / ${movement.reference_id}`
                        : "—"}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">{movement.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          {pagination.page > 1 ? (
            <Link
              href={hrefWithPage(baseParams, pagination.page - 1)}
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
            >
              上一頁
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">已是第一頁</span>
          )}
        </div>
        <div>
          {pagination.page < pagination.totalPages ? (
            <Link
              href={hrefWithPage(baseParams, pagination.page + 1)}
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
            >
              下一頁
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">已是最後一頁</span>
          )}
        </div>
      </div>
    </div>
  );
}
