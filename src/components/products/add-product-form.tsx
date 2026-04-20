"use client";

import { useActionState } from "react";
import { addProduct, type AddProductState } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AddProductState = { ok: true, message: null };

const pricingMethodOptions = [
  { value: "per_weight", label: "按重量" },
  { value: "per_piece", label: "按件" },
] as const;

const unitOptions = [
  { value: "kg", label: "kg" },
  { value: "catty", label: "司馬斤" },
  { value: "jin", label: "斤" },
  { value: "piece", label: "件" },
] as const;

export function AddProductForm() {
  const [state, formAction, pending] = useActionState(addProduct, initialState);

  return (
    <form action={formAction} className="bg-card max-w-3xl space-y-4 rounded-xl border p-4">
      <h2 className="text-sm font-medium">新增產品</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-muted-foreground text-xs font-medium">
            名稱 <span className="text-destructive">*</span>
          </label>
          <Input id="name" name="name" placeholder="例如：東星斑" required />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sku" className="text-muted-foreground text-xs font-medium">
            SKU
          </label>
          <Input id="sku" name="sku" placeholder="選填，例如：FISH-001" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="spec" className="text-muted-foreground text-xs font-medium">
            規格
          </label>
          <Input id="spec" name="spec" placeholder="選填，例如：2-3斤/條" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="pricing_method" className="text-muted-foreground text-xs font-medium">
            計價方式
          </label>
          <select
            id="pricing_method"
            name="pricing_method"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            defaultValue="per_weight"
          >
            {pricingMethodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sale_unit" className="text-muted-foreground text-xs font-medium">
            銷售單位
          </label>
          <select
            id="sale_unit"
            name="sale_unit"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            defaultValue="kg"
          >
            {unitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="stock_unit" className="text-muted-foreground text-xs font-medium">
            庫存單位
          </label>
          <select
            id="stock_unit"
            name="stock_unit"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            defaultValue="kg"
          >
            {unitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.message ? (
        <p className={state.ok ? "text-muted-foreground text-sm" : "text-destructive text-sm"}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "儲存中…" : "新增產品"}
      </Button>
    </form>
  );
}
