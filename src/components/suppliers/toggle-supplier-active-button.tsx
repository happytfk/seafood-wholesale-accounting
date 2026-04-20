"use client";

import { useTransition } from "react";
import { toggleSupplierActive } from "@/app/(dashboard)/suppliers/actions";
import { Button } from "@/components/ui/button";

type Props = {
  supplierId: string;
  isActive: boolean;
};

export function ToggleSupplierActiveButton({ supplierId, isActive }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleSupplierActive(supplierId, !isActive);
        });
      }}
    >
      {pending ? "更新中…" : isActive ? "停用" : "啟用"}
    </Button>
  );
}
