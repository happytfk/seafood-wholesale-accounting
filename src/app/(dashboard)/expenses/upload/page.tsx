export default function ExpenseUploadPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">收據上傳 (OCR)</h1>
      <p className="text-muted-foreground text-sm">
        拍照／上傳收據 → Gemini 抽取欄位 → 存入 Storage（待實作）。
      </p>
    </div>
  );
}
