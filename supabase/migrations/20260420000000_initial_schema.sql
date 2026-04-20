-- 海鮮批發業會計系統 — 初始 Schema（Supabase / PostgreSQL）

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.pricing_method AS ENUM ('per_piece', 'per_weight');
CREATE TYPE public.weight_unit AS ENUM ('piece', 'jin', 'catty', 'kg');
CREATE TYPE public.customer_segment AS ENUM (
  'restaurant',
  'wet_market',
  'processor',
  'retail_other',
  'other'
);
CREATE TYPE public.invoice_status AS ENUM ('draft', 'confirmed', 'cancelled');
CREATE TYPE public.payment_term_type AS ENUM ('cod', 'credit', 'installment');
CREATE TYPE public.ar_receipt_status AS ENUM ('pending', 'partial', 'paid');
CREATE TYPE public.inventory_movement_type AS ENUM (
  'purchase_in',
  'sale_out',
  'adjustment',
  'transfer',
  'wastage'
);
CREATE TYPE public.expense_ocr_status AS ENUM (
  'pending',
  'processed',
  'failed',
  'manual_override'
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff', 'accountant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  phone text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_name ON public.suppliers (name);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  spec text,
  pricing_method public.pricing_method NOT NULL DEFAULT 'per_weight',
  stock_unit public.weight_unit NOT NULL DEFAULT 'kg',
  sale_unit public.weight_unit NOT NULL DEFAULT 'kg',
  unit_to_kg_factor numeric(18, 8),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_unit_factor_ck CHECK (unit_to_kg_factor IS NULL OR unit_to_kg_factor > 0)
);
CREATE INDEX idx_products_name ON public.products (name);

CREATE TABLE public.customer_discount_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  default_discount_percent numeric(5, 2) NOT NULL DEFAULT 0
    CHECK (default_discount_percent >= 0 AND default_discount_percent <= 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  segment public.customer_segment NOT NULL DEFAULT 'other',
  discount_tier_id uuid REFERENCES public.customer_discount_tiers (id),
  discount_percent_override numeric(5, 2)
    CHECK (discount_percent_override IS NULL OR (discount_percent_override >= 0 AND discount_percent_override <= 100)),
  phone text,
  address text,
  payment_term public.payment_term_type NOT NULL DEFAULT 'credit',
  credit_days int CHECK (credit_days IS NULL OR credit_days >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_name ON public.customers (name);

CREATE TABLE public.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id),
  product_id uuid NOT NULL REFERENCES public.products (id),
  batch_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  unit public.weight_unit NOT NULL,
  quantity_received numeric(18, 4) NOT NULL CHECK (quantity_received > 0),
  quantity_remaining numeric(18, 4) NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost numeric(18, 4) NOT NULL CHECK (unit_cost >= 0),
  currency text NOT NULL DEFAULT 'HKD',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_batches_remaining_lte_received_ck CHECK (quantity_remaining <= quantity_received)
);
CREATE INDEX idx_batches_product ON public.inventory_batches (product_id);
CREATE INDEX idx_batches_supplier ON public.inventory_batches (supplier_id);

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.inventory_batches (id),
  product_id uuid NOT NULL REFERENCES public.products (id),
  movement_type public.inventory_movement_type NOT NULL,
  quantity_delta numeric(18, 4) NOT NULL,
  unit public.weight_unit NOT NULL,
  reference_table text,
  reference_id uuid,
  notes text,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_product ON public.inventory_movements (product_id);

CREATE TABLE public.sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  invoice_date date NOT NULL DEFAULT (CURRENT_DATE),
  status public.invoice_status NOT NULL DEFAULT 'draft',
  payment_term public.payment_term_type NOT NULL DEFAULT 'credit',
  subtotal numeric(18, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount numeric(18, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric(18, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(18, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid numeric(18, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  currency text NOT NULL DEFAULT 'HKD',
  notes text,
  pdf_storage_path text,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_customer ON public.sales_invoices (customer_id);
CREATE INDEX idx_invoices_date ON public.sales_invoices (invoice_date);

CREATE TABLE public.sales_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices (id) ON DELETE CASCADE,
  line_no int NOT NULL,
  product_id uuid REFERENCES public.products (id),
  name text NOT NULL,
  spec text,
  unit public.weight_unit NOT NULL,
  unit_price numeric(18, 4) NOT NULL CHECK (unit_price >= 0),
  gross_weight numeric(18, 4),
  basket_weight numeric(18, 4) NOT NULL DEFAULT 0 CHECK (basket_weight >= 0),
  moisture_deduction numeric(18, 4) NOT NULL DEFAULT 0 CHECK (moisture_deduction >= 0),
  net_weight numeric(18, 4) NOT NULL CHECK (net_weight >= 0),
  line_total numeric(18, 2) NOT NULL CHECK (line_total >= 0),
  batch_id uuid REFERENCES public.inventory_batches (id),
  UNIQUE (invoice_id, line_no)
);
CREATE INDEX idx_invoice_lines_invoice ON public.sales_invoice_lines (invoice_id);

CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices (id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'bank_transfer', 'fps', 'cheque', 'other')),
  reference_no text,
  notes text,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_receipts_invoice ON public.payment_receipts (invoice_id);

CREATE OR REPLACE VIEW public.sales_invoice_ar AS
SELECT
  i.*,
  (i.total_amount - i.amount_paid) AS balance_due,
  CASE
    WHEN i.total_amount <= 0 THEN 'paid'::public.ar_receipt_status
    WHEN i.amount_paid <= 0 THEN 'pending'::public.ar_receipt_status
    WHEN i.amount_paid < i.total_amount THEN 'partial'::public.ar_receipt_status
    ELSE 'paid'::public.ar_receipt_status
  END AS ar_status
FROM public.sales_invoices i
WHERE i.status <> 'cancelled';

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES public.expense_categories (id),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.expense_categories (id),
  supplier_name text,
  expense_date date,
  amount numeric(18, 2) NOT NULL CHECK (amount >= 0),
  tax_amount numeric(18, 2) CHECK (tax_amount IS NULL OR tax_amount >= 0),
  currency text NOT NULL DEFAULT 'HKD',
  description text,
  receipt_image_path text NOT NULL,
  ocr_status public.expense_ocr_status NOT NULL DEFAULT 'pending',
  ocr_raw jsonb,
  ocr_confidence numeric(5, 2),
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_date ON public.expenses (expense_date);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_batches_updated BEFORE UPDATE ON public.inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_invoices_updated BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.recalc_invoice_amount_paid()
RETURNS trigger AS $$
DECLARE
  inv uuid;
BEGIN
  inv := COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.sales_invoices s
  SET amount_paid = COALESCE((
    SELECT SUM(p.amount) FROM public.payment_receipts p WHERE p.invoice_id = inv
  ), 0),
      updated_at = now()
  WHERE s.id = inv;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_payment_receipts_recalc_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.payment_receipts
FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_amount_paid();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_discount_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_profiles" ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_products" ON public.products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_tiers" ON public.customer_discount_tiers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_customers" ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_batches" ON public.inventory_batches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_movements" ON public.inventory_movements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_invoices" ON public.sales_invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_invoice_lines" ON public.sales_invoice_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_receipts" ON public.payment_receipts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_expense_cat" ON public.expense_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_expenses" ON public.expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT ON public.sales_invoice_ar TO authenticated;

COMMENT ON TABLE public.products IS '海鮮產品主檔：支援計件/計重與斤、司馬斤、KG';
COMMENT ON TABLE public.inventory_batches IS '進貨批次：供應商、入貨價、即時剩餘庫存';
COMMENT ON COLUMN public.sales_invoice_lines.net_weight IS '淨重（已扣籃重、水份等）';
COMMENT ON VIEW public.sales_invoice_ar IS '應收帳款：balance_due、ar_status；期數帳看 payment_term';
