import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  Percent,
  Warehouse,
  ArrowRightLeft,
  FileText,
  Wallet,
  Receipt,
  Upload,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const sidebarNavigation: NavGroup[] = [
  {
    label: "總覽",
    items: [{ title: "儀表板", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "主檔資料",
    items: [
      { title: "產品", href: "/products", icon: Package },
      { title: "供應商", href: "/suppliers", icon: Truck },
      { title: "客戶", href: "/customers", icon: Users },
      { title: "折扣等級", href: "/customer-tiers", icon: Percent },
    ],
  },
  {
    label: "進銷存",
    items: [
      { title: "入庫批次", href: "/inventory/batches", icon: Warehouse },
      { title: "庫存異動", href: "/inventory/movements", icon: ArrowRightLeft },
    ],
  },
  {
    label: "銷售",
    items: [
      { title: "銷售開單", href: "/sales/invoices", icon: FileText },
      { title: "應收帳款 (AR)", href: "/sales/ar", icon: Wallet },
    ],
  },
  {
    label: "財務",
    items: [
      { title: "開支管理", href: "/expenses", icon: Receipt },
      { title: "收據上傳 (OCR)", href: "/expenses/upload", icon: Upload },
    ],
  },
  {
    label: "系統",
    items: [{ title: "設定", href: "/settings", icon: Settings }],
  },
];
