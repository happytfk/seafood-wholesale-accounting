import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

function escapeCsv(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(values: Array<string | number>): string {
  return values.map(escapeCsv).join(",");
}

export async function GET(request: Request) {
  try {
    await requireRole(["owner", "accountant", "manager", "staff"]);
  } catch {
    return NextResponse.json({ error: "你無權限匯出庫存批次" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "尚未設定 Supabase" }, { status: 400 });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") ?? "";
  const supplierId = url.searchParams.get("supplierId") ?? "";
  const onlyOpen = (url.searchParams.get("onlyOpen") ?? "") === "1";
  const supabase = createAdminClient();

  let query = supabase
    .from("inventory_batches")
    .select(
      "id, batch_code, received_at, unit, quantity_received, quantity_remaining, unit_cost, suppliers(name), products(name, spec)",
    )
    .order("received_at", { ascending: false })
    .limit(5000);

  if (productId) query = query.eq("product_id", productId);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  if (onlyOpen) query = query.gt("quantity_remaining", 0);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const lines: string[] = [];
  lines.push(csvRow(["入庫批次報表"]));
  lines.push(csvRow(["匯出時間", new Date().toISOString()]));
  lines.push(
    csvRow(["篩選", `productId=${productId || "all"}, supplierId=${supplierId || "all"}, onlyOpen=${onlyOpen}`]),
  );
  lines.push("");
  lines.push(
    csvRow(["日期", "批次號", "供應商", "產品", "規格", "收貨數量", "剩餘數量", "單位", "單位成本(HKD)"]),
  );

  for (const row of data ?? []) {
    const supplierCell = row.suppliers as { name: string } | { name: string }[] | null;
    const productCell = row.products as
      | { name: string; spec: string | null }
      | { name: string; spec: string | null }[]
      | null;
    const supplierName = Array.isArray(supplierCell)
      ? (supplierCell[0]?.name ?? "—")
      : (supplierCell?.name ?? "—");
    const productName = Array.isArray(productCell) ? (productCell[0]?.name ?? "—") : (productCell?.name ?? "—");
    const productSpec = Array.isArray(productCell)
      ? (productCell[0]?.spec ?? "")
      : (productCell?.spec ?? "");

    lines.push(
      csvRow([
        String(row.received_at).slice(0, 10),
        row.batch_code ?? "",
        supplierName,
        productName,
        productSpec,
        Number(row.quantity_received ?? 0).toFixed(3),
        Number(row.quantity_remaining ?? 0).toFixed(3),
        row.unit,
        Number(row.unit_cost ?? 0).toFixed(4),
      ]),
    );
  }

  const csv = `\uFEFF${lines.join("\n")}`;
  const fileName = `inventory-batches-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
