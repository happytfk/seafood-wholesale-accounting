"use client";

import { useActionState } from "react";
import {
  addInventoryBatch,
  type AddBatchState,
  type BatchProductOption,
  type BatchSupplierOption,
} from "@/app/(dashboard)/inventory/batches/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AddBatchState = { ok: true, message: null };

const unitOptions = [
  { value: "kg", label: "kg" },
  { value: "catty", label: "司馬斤" },
  { value: "jin", label: "斤" },
  { value: "piece", label: "件" },
] as const;

type Props = {
  suppliers: BatchSupplierOption[];
  products: BatchProductOption[];
};

export function AddInventoryBatchForm({ suppliers, products }: Props) {
  const [state, formAction, pending] = useActionState(addInventoryBatch, initialState);

  return (
    <form action={formAction} className="bg-card space-y-4 rounded-xl border p-4">
      <h2 className="text-sm font-medium">新增入庫批次</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="supplier_id" className="text-muted-foreground text-xs font-medium">
            供應商 <span className="text-destructive">*</span>
          </label>
          <select
            id="supplier_id"
            name="supplier_id"
            required
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
          >
            <option value="">請選擇供應商</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="product_id" className="text-muted-foreground text-xs font-medium">
            產品 <span className="text-destructive">*</span>
          </label>
          <select
            id="product_id"
            name="product_id"
            required
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
          >
            <option value="">請選擇產品</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {product.spec ? ` (${product.spec})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="unit" className="text-muted-foreground text-xs font-medium">
            單位 <span className="text-destructive">*</span>
          </label>
          <select
            id="unit"
            name="unit"
            required
            defaultValue="kg"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
          >
            {unitOptions.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quantity_received" className="text-muted-foreground text-xs font-medium">
            入庫數量 <span className="text-destructive">*</span>
          </label>
          <Input
            id="quantity_received"
            name="quantity_received"
            type="number"
            min="0"
            step="0.001"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="unit_cost" className="text-muted-foreground text-xs font-medium">
            單位成本（HKD） <span className="text-destructive">*</span>
          </label>
          <Input id="unit_cost" name="unit_cost" type="number" min="0" step="0.0001" required />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="received_date" className="text-muted-foreground text-xs font-medium">
            入庫日期
          </label>
          <Input id="received_date" name="received_date" type="date" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="batch_code" className="text-muted-foreground text-xs font-medium">
            批次編號
          </label>
          <Input id="batch_code" name="batch_code" placeholder="例如 B20260420-01" />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="notes" className="text-muted-foreground text-xs font-medium">
            備註
          </label>
          <Input id="notes" name="notes" placeholder="選填" />
        </div>
      </div>

      {state.message ? (
        <p className={state.ok ? "text-muted-foreground text-sm" : "text-destructive text-sm"}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "儲存中…" : "新增批次"}
      </Button>
    </form>
  );
}
