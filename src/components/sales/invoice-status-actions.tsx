"use client";

import { useTransition } from "react";
import {
  changeInvoiceStatus,
  type ChangeInvoiceStatus,
} from "@/app/(dashboard)/sales/invoices/actions";
import { Button } from "@/components/ui/button";

type Props = {
  invoiceId: string;
  status: ChangeInvoiceStatus;
};

export function InvoiceStatusActions({ invoiceId, status }: Props) {
  const [pending, startTransition] = useTransition();

  const runStatusChange = (targetStatus: ChangeInvoiceStatus) => {
    startTransition(async () => {
      const result = await changeInvoiceStatus(invoiceId, targetStatus);
      if (!result.ok) {
        window.alert(result.message);
      }
    });
  };

  if (status === "cancelled") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {status === "draft" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => runStatusChange("confirmed")}
        >
          確認
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => runStatusChange("cancelled")}
      >
        作廢
      </Button>
    </div>
  );
}
