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
    return NextResponse.json({ error: "你無權限匯出庫存異動" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "尚未設定 Supabase" }, { status: 400 });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") ?? "";
  const movementType = url.searchParams.get("movementType") ?? "all";
  const fromDate = url.searchParams.get("fromDate") ?? "";
  const toDate = url.searchParams.get("toDate") ?? "";
  const supabase = createAdminClient();

  let query = supabase
    .from("inventory_movements")
    .select(
      "id, created_at, movement_type, quantity_delta, unit, reference_table, reference_id, notes, products(name), inventory_batches(batch_code)",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (productId) query = query.eq("product_id", productId);
  if (
    movementType === "purchase_in" ||
    movementType === "sale_out" ||
    movementType === "adjustment" ||
    movementType === "transfer" ||
    movementType === "wastage"
  ) {
    query = query.eq("movement_type", movementType);
  }
  if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00+08:00`);
  if (toDate) query = query.lte("created_at", `${toDate}T23:59:59+08:00`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const lines: string[] = [];
  lines.push(csvRow(["庫存異動報表"]));
  lines.push(csvRow(["匯出時間", new Date().toISOString()]));
  lines.push(
    csvRow([
      "篩選",
      `productId=${productId || "all"}, movementType=${movementType || "all"}, fromDate=${fromDate || "-"}, toDate=${toDate || "-"}`,
    ]),
  );
  lines.push("");
  lines.push(
    csvRow(["時間", "類型", "產品", "批次號", "數量變化", "單位", "Reference Table", "Reference ID", "備註"]),
  );

  for (const row of data ?? []) {
    const productCell = row.products as { name: string } | { name: string }[] | null;
    const batchCell = row.inventory_batches as
      | { batch_code: string | null }
      | { batch_code: string | null }[]
      | null;
    const productName = Array.isArray(productCell) ? (productCell[0]?.name ?? "—") : (productCell?.name ?? "—");
    const batchCode = Array.isArray(batchCell)
      ? (batchCell[0]?.batch_code ?? "")
      : (batchCell?.batch_code ?? "");

    lines.push(
      csvRow([
        String(row.created_at),
        row.movement_type,
        productName,
        batchCode,
        Number(row.quantity_delta ?? 0).toFixed(3),
        row.unit,
        row.reference_table ?? "",
        row.reference_id ?? "",
        row.notes ?? "",
      ]),
    );
  }

  const csv = `\uFEFF${lines.join("\n")}`;
  const fileName = `inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
