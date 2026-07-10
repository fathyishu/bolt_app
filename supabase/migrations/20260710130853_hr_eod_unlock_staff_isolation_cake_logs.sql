-- ══════════════════════════════════════════════════════
-- 1. HR full EOD access: allow HR to update eod_reports
-- ══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Managers can update EOD reports" ON eod_reports;
DROP POLICY IF EXISTS "Admins can update EOD reports" ON eod_reports;
DROP POLICY IF EXISTS "Privileged users can update eod_reports" ON eod_reports;

-- Recreate with HR included
CREATE POLICY "Privileged users can update eod_reports"
  ON eod_reports FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
  ));

-- ══════════════════════════════════════════════════════
-- 2. Staff data isolation: customers RLS
--    Staff see only their own customers (added_by = me)
--    Admin/manager/hr see all
-- ══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;

CREATE POLICY "Users can view own customers"
  ON customers FOR SELECT TO authenticated
  USING (
    added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
    )
  );

-- ══════════════════════════════════════════════════════
-- 3. Staff data isolation: leads RLS
--    Staff see only leads they own or are assigned to
-- ══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can view leads" ON leads;

CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
    )
  );

-- ══════════════════════════════════════════════════════
-- 4. Late Cake: add detail columns to late_cake_slices
--    for audit logging per entry
-- ══════════════════════════════════════════════════════
ALTER TABLE late_cake_slices ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '';
ALTER TABLE late_cake_slices ADD COLUMN IF NOT EXISTS logged_date date;
ALTER TABLE late_cake_slices ADD COLUMN IF NOT EXISTS logged_time timestamptz;

-- Late cake logs table for detailed history entries
CREATE TABLE IF NOT EXISTS late_cake_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cycle_id text NOT NULL,
  slices int NOT NULL DEFAULT 1,
  reason text NOT NULL DEFAULT '',
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  logged_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE late_cake_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cake logs"
  ON late_cake_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "HR and admin can insert cake logs"
  ON late_cake_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
  ));

CREATE INDEX IF NOT EXISTS late_cake_logs_user_cycle_idx ON late_cake_logs(user_id, cycle_id);
CREATE INDEX IF NOT EXISTS late_cake_logs_logged_at_idx ON late_cake_logs(logged_at DESC);
