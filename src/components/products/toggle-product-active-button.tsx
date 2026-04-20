"use client";

import { useTransition } from "react";
import { toggleProductActive } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";

type Props = {
  productId: string;
  isActive: boolean;
};

export function ToggleProductActiveButton({ productId, isActive }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleProductActive(productId, !isActive);
        });
      }}
    >
      {pending ? "更新中…" : isActive ? "停用" : "啟用"}
    </Button>
  );
}
