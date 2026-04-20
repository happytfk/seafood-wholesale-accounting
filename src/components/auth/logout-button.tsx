"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrowserAuthClient } from "@/lib/supabase/browser-auth";

export function LogoutButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        const supabase = createBrowserAuthClient();
        await supabase.auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      登出
    </Button>
  );
}
