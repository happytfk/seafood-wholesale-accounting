"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserAuthClient } from "@/lib/supabase/browser-auth";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      if (!email || !password) {
        setError("請輸入電郵與密碼");
        return;
      }

      const supabase = createBrowserAuthClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "登入失敗，請檢查設定與帳號密碼";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="bg-card w-full max-w-md space-y-4 rounded-xl border p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">登入系統</h1>
        <p className="text-muted-foreground text-sm">請使用 Supabase 已建立的帳號登入。</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-muted-foreground text-xs font-medium">
          電郵
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-muted-foreground text-xs font-medium">
          密碼
        </label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "登入中…" : "登入"}
      </Button>
    </form>
  );
}
