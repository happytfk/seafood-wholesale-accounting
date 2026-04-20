export default function SalesInvoicesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">銷售開單</h1>
      <p className="text-muted-foreground text-sm">
        開單時請填<strong className="text-foreground">毛重、籃重（皮重）、扣水份</strong>
        ，淨重用 <code className="text-foreground">computeNetWeight</code>{" "}
        統一計算，避免金額錯誤。
      </p>
    </div>
  );
}
