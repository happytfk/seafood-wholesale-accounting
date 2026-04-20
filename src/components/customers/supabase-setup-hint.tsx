export function SupabaseSetupHint() {
  return (
    <div className="bg-card text-card-foreground max-w-2xl space-y-3 rounded-xl border border-amber-500/40 p-4 text-sm">
      <p className="font-medium text-amber-200">尚未連接 Supabase</p>
      <ol className="text-muted-foreground list-decimal space-y-2 pl-5 leading-relaxed">
        <li>
          喺 Supabase → <strong className="text-foreground">SQL Editor</strong> 開新查詢。
        </li>
        <li>
          喺 Cursor 打開檔案{" "}
          <code className="text-foreground bg-muted rounded px-1 py-0.5 text-xs">
            supabase/migrations/20260420000000_initial_schema.sql
          </code>
          ，<strong className="text-foreground">全選複製內容</strong>（唔好貼檔案路徑），貼上
          SQL Editor 再 Run。
        </li>
        <li>
          Supabase → <strong className="text-foreground">Project Settings → API</strong> 複製{" "}
          <strong className="text-foreground">Project URL</strong>。
        </li>
        <li>
          同一頁複製{" "}
          <strong className="text-foreground">service_role</strong> 密鑰（
          <span className="text-foreground">secret</span>
          ，勿分享、勿放到瀏覽器前端）。
        </li>
        <li>
          喺專案根目錄新增{" "}
          <code className="text-foreground bg-muted rounded px-1 py-0.5 text-xs">.env.local</code>{" "}
          ，參考{" "}
          <code className="text-foreground bg-muted rounded px-1 py-0.5 text-xs">example.env</code>
          。
        </li>
        <li>
          停咗再開 <code className="text-foreground bg-muted rounded px-1">npm run dev</code>。
        </li>
      </ol>
    </div>
  );
}
