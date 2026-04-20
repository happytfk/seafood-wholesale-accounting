"use client";

import { useActionState } from "react";
import {
  addPaymentReceipt,
  type AddReceiptState,
  type ReceivableInvoiceOption,
} from "@/app/(dashboard)/sales/ar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AddReceiptState = { ok: true, message: null };

const methodOptions = [
  { value: "cash", label: "現金" },
  { value: "bank_transfer", label: "銀行轉帳" },
  { value: "fps", label: "FPS" },
  { value: "cheque", label: "支票" },
  { value: "other", label: "其他" },
] as const;

type Props = {
  month: string;
  customerId: string;
  receivableInvoices: ReceivableInvoiceOption[];
};

export function AddPaymentReceiptForm({ month, customerId, receivableInvoices }: Props) {
  const [state, formAction, pending] = useActionState(addPaymentReceipt, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="bg-card space-y-4 rounded-xl border p-4">
      <h2 className="text-sm font-medium">登記收款</h2>

      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="customer_id" value={customerId} />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="invoice_id" className="text-muted-foreground text-xs font-medium">
            對應發票 <span className="text-destructive">*</span>
          </label>
          <select
            id="invoice_id"
            name="invoice_id"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            defaultValue=""
            required
          >
            <option value="" disabled>
              請選擇發票
            </option>
            {receivableInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoice_no}｜{invoice.invoice_date}｜未收 HKD{" "}
                {Number(invoice.balance_due).toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="amount" className="text-muted-foreground text-xs font-medium">
            收款金額 <span className="text-destructive">*</span>
          </label>
          <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="received_date" className="text-muted-foreground text-xs font-medium">
            收款日期
          </label>
          <Input id="received_date" name="received_date" type="date" defaultValue={today} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="method" className="text-muted-foreground text-xs font-medium">
            收款方式
          </label>
          <select
            id="method"
            name="method"
            className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
            defaultValue="cash"
          >
            {methodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reference_no" className="text-muted-foreground text-xs font-medium">
            參考編號
          </label>
          <Input id="reference_no" name="reference_no" placeholder="選填，例如：FPS Ref" />
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
        {pending ? "提交中…" : "登記收款"}
      </Button>
    </form>
  );
}
