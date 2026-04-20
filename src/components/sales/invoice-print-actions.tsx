"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function InvoicePrintActions() {
  const router = useRouter();

  return (
    <div className="print:hidden flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
        返回
      </Button>
      <Button type="button" size="sm" onClick={() => window.print()}>
        列印／匯出 PDF
      </Button>
    </div>
  );
}
