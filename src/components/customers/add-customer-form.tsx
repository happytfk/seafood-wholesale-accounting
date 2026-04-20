"use client";

import { useActionState } from "react";
import { addCustomer, type AddCustomerState } from "@/app/(dashboard)/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AddCustomerState = { ok: true, message: null };

const segmentOptions: { value: string; label: string }[] = [
  { value: "restaurant", label: "酒樓／餐飲" },
  { value: "wet_market", label: "街市零售商" },
  { value: "processor", label: "加工／二批" },
  { value: "retail_other", label: "其他零售" },
  { value: "other", label: "其他" },
];

export function AddCustomerForm() {
  const [state, formAction, pending] = useActionState(addCustomer, initialState);

  return (
    <form action={formAction} className="bg-card max-w-xl space-y-4 rounded-xl border p-4">
      <h2 className="text-sm font-medium">新增客戶</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="name" className="text-muted-foreground text-xs font-medium">
            名稱 <span className="text-destructive">*</span>
          </label>
          <Input id="name" name="name" placeholder="例如：XX 酒樓" required autoComplete="organization" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="segment" className="text-muted-foreground text-xs font-medium">
            類型
          </label>
          <select
            id="segment"
            name="segment"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            defaultValue="other"
          >
            {segmentOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-muted-foreground text-xs font-medium">
            電話
          </label>
          <Input id="phone" name="phone" type="tel" placeholder="選填" autoComplete="tel" />
        </div>
      </div>
      {state.message ? (
        <p
          className={
            state.ok ? "text-muted-foreground text-sm" : "text-destructive text-sm"
          }
          role={state.ok ? undefined : "alert"}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "儲存中…" : "新增"}
      </Button>
    </form>
  );
}
