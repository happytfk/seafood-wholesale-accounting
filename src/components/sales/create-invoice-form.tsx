"use client";

import { useActionState, useMemo, useState } from "react";
import { createInvoice, type CreateInvoiceState, type CustomerOption, type ProductOption } from "@/app/(dashboard)/sales/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeNetWeight, lineTotalFromNetWeight } from "@/lib/units/hk-catty-tael";

const initialState: CreateInvoiceState = { ok: true, message: null };

type Props = {
  customers: CustomerOption[];
  products: ProductOption[];
};

type InvoiceLineInput = {
  key: number;
  productId: string;
  grossWeight: string;
  basketWeight: string;
  moistureDeduction: string;
  unitPrice: string;
};

function createDefaultLine(key: number): InvoiceLineInput {
  return {
    key,
    productId: "",
    grossWeight: "0",
    basketWeight: "0",
    moistureDeduction: "0",
    unitPrice: "0",
  };
}

export function CreateInvoiceForm({ customers, products }: Props) {
  const [state, formAction, pending] = useActionState(createInvoice, initialState);
  const [lines, setLines] = useState<InvoiceLineInput[]>([createDefaultLine(1)]);
  const [nextLineKey, setNextLineKey] = useState(2);

  const estimates = useMemo(() => {
    const lineTotals = lines.map((line) => {
      try {
        const netWeight = computeNetWeight({
          grossWeight: Number(line.grossWeight),
          basketTare: Number(line.basketWeight),
          moistureDeduction: Number(line.moistureDeduction),
        });
        const lineTotal = lineTotalFromNetWeight({
          netWeight,
          unitPrice: Number(line.unitPrice),
          netWeightFractionDigits: 3,
        });
        return { ok: true as const, netWeight, lineTotal };
      } catch {
        return { ok: false as const, netWeight: 0, lineTotal: 0 };
      }
    });
    const subtotal = lineTotals.reduce(
      (sum, line) => sum + (line.ok ? line.lineTotal : 0),
      0,
    );
    return { lineTotals, subtotal };
  }, [lines]);

  function updateLine(key: number, patch: Partial<InvoiceLineInput>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, createDefaultLine(nextLineKey)]);
    setNextLineKey((prev) => prev + 1);
  }

  function removeLine(key: number) {
    setLines((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((line) => line.key !== key);
    });
  }

  return (
    <form action={formAction} className="bg-card space-y-4 rounded-xl border p-4">
      <h2 className="text-sm font-medium">新增發票（多行）</h2>

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <label htmlFor="customer_id" className="text-muted-foreground text-xs font-medium">
            客戶 <span className="text-destructive">*</span>
          </label>
          <select
            id="customer_id"
            name="customer_id"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            defaultValue=""
            required
          >
            <option value="" disabled>
              請選擇客戶
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={line.key} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">明細 #{idx + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= 1}
                >
                  刪除
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-muted-foreground text-xs font-medium">
                    產品 <span className="text-destructive">*</span>
                  </label>
                  <select
                    name="line_product_id"
                    className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
                    value={line.productId}
                    onChange={(event) =>
                      updateLine(line.key, { productId: event.target.value })
                    }
                    required
                  >
                    <option value="" disabled>
                      請選擇產品
                    </option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-medium">
                    毛重（kg）<span className="text-destructive">*</span>
                  </label>
                  <Input
                    name="line_gross_weight"
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.grossWeight}
                    onChange={(event) =>
                      updateLine(line.key, { grossWeight: event.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-medium">
                    籃重／皮重（kg）<span className="text-destructive">*</span>
                  </label>
                  <Input
                    name="line_basket_weight"
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.basketWeight}
                    onChange={(event) =>
                      updateLine(line.key, { basketWeight: event.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-medium">
                    水份扣減（kg）
                  </label>
                  <Input
                    name="line_moisture_deduction"
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.moistureDeduction}
                    onChange={(event) =>
                      updateLine(line.key, { moistureDeduction: event.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-medium">
                    單價（HKD / kg）<span className="text-destructive">*</span>
                  </label>
                  <Input
                    name="line_unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) =>
                      updateLine(line.key, { unitPrice: event.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="bg-muted/40 grid gap-1 rounded-lg border px-3 py-2 text-sm md:grid-cols-2">
                <p>
                  預估淨重：{" "}
                  <strong className="font-semibold">
                    {estimates.lineTotals[idx]?.ok
                      ? estimates.lineTotals[idx].netWeight.toFixed(3)
                      : "—"}{" "}
                    kg
                  </strong>
                </p>
                <p>
                  預估金額：{" "}
                  <strong className="font-semibold">
                    {estimates.lineTotals[idx]?.ok
                      ? `HKD ${estimates.lineTotals[idx].lineTotal.toFixed(2)}`
                      : "—"}
                  </strong>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-start">
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            + 新增一行
          </Button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-muted-foreground text-xs font-medium">
            備註
          </label>
          <Input id="notes" name="notes" placeholder="選填，例如：早市、A貨" />
        </div>
      </div>

      <div className="bg-muted/40 rounded-lg border px-3 py-2 text-sm">
        發票預估小計：{" "}
        <strong className="font-semibold">HKD {estimates.subtotal.toFixed(2)}</strong>
      </div>

      {state.message ? (
        <p className={state.ok ? "text-muted-foreground text-sm" : "text-destructive text-sm"}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "建立中…" : "建立草稿發票"}
      </Button>
    </form>
  );
}
