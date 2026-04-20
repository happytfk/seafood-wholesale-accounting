# 海鮮批發會計系統

Next.js（App Router）+ Tailwind CSS v4 + shadcn/ui，後端規劃為 Supabase。專案已建立於本機目錄（非 Cursor 安裝磁碟）。

## 路徑

預設位置：`/Users/chunmingyuen/seafood-wholesale-accounting`

在 Cursor 請用 **File → Open Folder** 開啟上述資料夾，即可編輯與執行。

## 指令

```bash
cd /Users/chunmingyuen/seafood-wholesale-accounting
npm run dev
```

瀏覽器開啟 [http://localhost:3000](http://localhost:3000)（會導向 `/dashboard`）。

## 已包含

- **側邊欄導航**（繁體中文、`src/components/app-sidebar.tsx`、`src/lib/navigation.ts`）
- **港斤／兩換算與籃重淨重**（`src/lib/units/hk-catty-tael.ts`，16 兩 = 1 斤）
- **Supabase 初始 SQL**（`supabase/migrations/20260420000000_initial_schema.sql`）
- **深色高對比**（`src/app/layout.tsx` 使用 `className="dark"`）

## 後續

- 連接 Supabase 專案並執行 migration
- 開單表單：毛重、**籃重（皮重）**、水份扣減 → `computeNetWeight`
- 可選：PWA、離線佇列與同步
