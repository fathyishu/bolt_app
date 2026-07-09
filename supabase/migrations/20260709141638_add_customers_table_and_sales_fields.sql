-- ══════════════════════════════════════════════════════
-- Master Customer Database
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  added_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Admins and managers can update customers"
  ON customers FOR UPDATE TO authenticated
  USING (
    added_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  )
  WITH CHECK (
    added_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

CREATE POLICY "Admins can delete customers"
  ON customers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')));

CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone);
CREATE INDEX IF NOT EXISTS customers_added_by_idx ON customers(added_by);

-- ══════════════════════════════════════════════════════
-- Add customer_id FK and new sale fields to leads
-- ══════════════════════════════════════════════════════
ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tracking_id text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cod_payment_updated boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cod_payment_updated_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Back-fill owner_id from assigned_to for existing rows
UPDATE leads SET owner_id = assigned_to WHERE owner_id IS NULL AND assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_owner_id_idx ON leads(owner_id);
CREATE INDEX IF NOT EXISTS leads_customer_id_idx ON leads(customer_id);

-- RLS update for leads: owners can update their own leads
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

-- ══════════════════════════════════════════════════════
-- Monthly Targets per User
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS monthly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month int NOT NULL,
  year int NOT NULL,
  target1 int NOT NULL DEFAULT 0,  -- minimum target
  target2 int NOT NULL DEFAULT 0,  -- commission increase target (unlocks ₹8/piece)
  target3 int NOT NULL DEFAULT 0,  -- salary/reward target
  reward_amount numeric(10,2) NOT NULL DEFAULT 0,  -- custom reward for target3
  reward_label text NOT NULL DEFAULT '', -- label for reward (e.g. "Bonus ₹5000")
  set_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own targets"
  ON monthly_targets FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

CREATE POLICY "Admins can insert targets"
  ON monthly_targets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')));

CREATE POLICY "Admins can update targets"
  ON monthly_targets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')));

CREATE POLICY "Admins can delete targets"
  ON monthly_targets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager')));

CREATE INDEX IF NOT EXISTS monthly_targets_user_month_idx ON monthly_targets(user_id, month, year);
