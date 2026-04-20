"use client";

import { useActionState } from "react";
import { addSupplier, type AddSupplierState } from "@/app/(dashboard)/suppliers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AddSupplierState = { ok: true, message: null };

export function AddSupplierForm() {
  const [state, formAction, pending] = useActionState(addSupplier, initialState);

  return (
    <form action={formAction} className="bg-card max-w-3xl space-y-4 rounded-xl border p-4">
      <h2 className="text-sm font-medium">新增供應商</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-muted-foreground text-xs font-medium">
            名稱 <span className="text-destructive">*</span>
          </label>
          <Input id="name" name="name" placeholder="例如：XX 海鮮批發" required />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="code" className="text-muted-foreground text-xs font-medium">
            代碼
          </label>
          <Input id="code" name="code" placeholder="選填，例如：SUP-001" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-muted-foreground text-xs font-medium">
            電話
          </label>
          <Input id="phone" name="phone" type="tel" placeholder="選填" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="address" className="text-muted-foreground text-xs font-medium">
            地址
          </label>
          <Input id="address" name="address" placeholder="選填" />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="notes" className="text-muted-foreground text-xs font-medium">
            備註
          </label>
          <Input id="notes" name="notes" placeholder="選填，例如：夜船貨、送貨時間" />
        </div>
      </div>

      {state.message ? (
        <p className={state.ok ? "text-muted-foreground text-sm" : "text-destructive text-sm"}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "儲存中…" : "新增供應商"}
      </Button>
    </form>
  );
}
