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

function NumberInput({
  id,
  name,
  step = "0.01",
  min = "0",
  defaultValue,
  required,
  onChange,
}: {
  id: string;
  name: string;
  step?: string;
  min?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <Input
      id={id}
      name={name}
      type="number"
      min={min}
      step={step}
      required={required}
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export function CreateInvoiceForm({ customers, products }: Props) {
  const [state, formAction, pending] = useActionState(createInvoice, initialState);
  const [grossWeight, setGrossWeight] = useState("0");
  const [basketWeight, setBasketWeight] = useState("0");
  const [moistureDeduction, setMoistureDeduction] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");

  const estimate = useMemo(() => {
    try {
      const netWeight = computeNetWeight({
        grossWeight: Number(grossWeight),
        basketTare: Number(basketWeight),
        moistureDeduction: Number(moistureDeduction),
      });
      const subtotal = lineTotalFromNetWeight({
        netWeight,
        unitPrice: Number(unitPrice),
        netWeightFractionDigits: 3,
      });
      return { ok: true as const, netWeight, subtotal };
    } catch {
      return { ok: false as const, netWeight: 0, subtotal: 0 };
    }
  }, [grossWeight, basketWeight, moistureDeduction, unitPrice]);

  return (
    <form action={formAction} className="bg-card space-y-4 rounded-xl border p-4">
      <h2 className="text-sm font-medium">新增發票（單行）</h2>

      <div className="grid gap-3 md:grid-cols-2">
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

        <div className="space-y-1.5">
          <label htmlFor="product_id" className="text-muted-foreground text-xs font-medium">
            產品 <span className="text-destructive">*</span>
          </label>
          <select
            id="product_id"
            name="product_id"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            defaultValue=""
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
          <label htmlFor="gross_weight" className="text-muted-foreground text-xs font-medium">
            毛重（kg）<span className="text-destructive">*</span>
          </label>
          <NumberInput
            id="gross_weight"
            name="gross_weight"
            step="0.001"
            defaultValue="0"
            required
            onChange={setGrossWeight}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="basket_weight" className="text-muted-foreground text-xs font-medium">
            籃重／皮重（kg）<span className="text-destructive">*</span>
          </label>
          <NumberInput
            id="basket_weight"
            name="basket_weight"
            step="0.001"
            defaultValue="0"
            required
            onChange={setBasketWeight}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="moisture_deduction" className="text-muted-foreground text-xs font-medium">
            水份扣減（kg）
          </label>
          <NumberInput
            id="moisture_deduction"
            name="moisture_deduction"
            step="0.001"
            defaultValue="0"
            required
            onChange={setMoistureDeduction}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="unit_price" className="text-muted-foreground text-xs font-medium">
            單價（HKD / kg）<span className="text-destructive">*</span>
          </label>
          <NumberInput
            id="unit_price"
            name="unit_price"
            step="0.01"
            defaultValue="0"
            required
            onChange={setUnitPrice}
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="notes" className="text-muted-foreground text-xs font-medium">
            備註
          </label>
          <Input id="notes" name="notes" placeholder="選填，例如：早市、A貨" />
        </div>
      </div>

      <div className="bg-muted/40 grid gap-1 rounded-lg border px-3 py-2 text-sm md:grid-cols-2">
        <p>
          預估淨重：{" "}
          <strong className="font-semibold">
            {estimate.ok ? estimate.netWeight.toFixed(3) : "—"} kg
          </strong>
        </p>
        <p>
          預估小計：{" "}
          <strong className="font-semibold">
            {estimate.ok ? `HKD ${estimate.subtotal.toFixed(2)}` : "—"}
          </strong>
        </p>
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
