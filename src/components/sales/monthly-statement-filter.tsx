"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";

type CustomerOption = {
  id: string;
  name: string;
};

type Props = {
  month: string;
  customerId: string;
  customers: CustomerOption[];
};

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyStatementFilter({ month, customerId, customers }: Props) {
  const defaultMonth = useMemo(() => month || currentMonthKey(), [month]);

  return (
    <form method="get" className="bg-card flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-end">
      <div className="space-y-1.5">
        <label htmlFor="month" className="text-muted-foreground text-xs font-medium">
          月份
        </label>
        <input
          id="month"
          name="month"
          type="month"
          defaultValue={defaultMonth}
          className="border-input bg-background focus-visible:ring-ring/50 h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
          required
        />
      </div>

      <div className="space-y-1.5 md:min-w-[240px]">
        <label htmlFor="customerId" className="text-muted-foreground text-xs font-medium">
          客戶
        </label>
        <select
          id="customerId"
          name="customerId"
          defaultValue={customerId}
          className="border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 dark:bg-input/30"
          required
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" size="sm">
        查看月結
      </Button>
    </form>
  );
}
