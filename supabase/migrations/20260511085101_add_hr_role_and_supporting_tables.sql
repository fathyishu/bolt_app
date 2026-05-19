/*
  # Add HR Role and Supporting Tables

  ## New Role
  - Adds 'hr' as a valid role in the profiles role check constraint

  ## New Tables
  1. `late_cake_slices` — tracks individual slice contributions per user per cycle
     - id, user_id, slices (int), cycle_id (text, e.g. "2026-05"), created_at
  2. `late_cake_cycles` — records each completed cake purchase / cycle reset
     - id, finalized_at, total_slices, contributions (jsonb snapshot), triggered_by
  3. `attendance_logs` — HR-logged entry times per user per date
     - id, user_id, date, entry_time (time), logged_by, notes, created_at
  4. `leave_requests` — staff leave/WFH requests and approvals
     - id, user_id, type ('leave'|'wfh'), date, status ('pending'|'approved'|'rejected'), 
       reason, reviewed_by, created_at
  5. `leave_balances` — per-user monthly leave/WFH counters
     - id, user_id, month (int), year (int), leaves_remaining (int), wfh_remaining (int)
  6. `level_thresholds` — admin-editable level piece requirements
     - id, level_name, min_pieces, updated_by, updated_at

  ## Profile table changes
  - Add streak_frozen boolean (for admin streak freeze)
  - role check updated to include 'hr'
*/

-- Update profiles role check to include 'hr'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'hr', 'manager', 'sales_executive'));

-- Add streak_frozen to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_frozen boolean NOT NULL DEFAULT false;

-- ── Late Cake ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS late_cake_slices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slices int NOT NULL DEFAULT 0,
  cycle_id text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cycle_id)
);

CREATE TABLE IF NOT EXISTS late_cake_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finalized_at timestamptz NOT NULL DEFAULT now(),
  total_slices int NOT NULL DEFAULT 0,
  contributions jsonb NOT NULL DEFAULT '[]',
  triggered_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE late_cake_slices ENABLE ROW LEVEL SECURITY;
ALTER TABLE late_cake_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cake slices"
  ON late_cake_slices FOR SELECT TO authenticated USING (true);

CREATE POLICY "HR and admin can insert cake slices"
  ON late_cake_slices FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')
  ));

CREATE POLICY "HR and admin can update cake slices"
  ON late_cake_slices FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')));

CREATE POLICY "Authenticated users can view cake cycles"
  ON late_cake_cycles FOR SELECT TO authenticated USING (true);

CREATE POLICY "HR and admin can insert cake cycles"
  ON late_cake_cycles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')
  ));

-- ── Attendance ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  entry_time time,
  logged_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON attendance_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
  ));

CREATE POLICY "HR and admin can insert attendance"
  ON attendance_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')
  ));

CREATE POLICY "HR and admin can update attendance"
  ON attendance_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')));

-- ── Leave Requests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('leave', 'wfh')),
  date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leave requests"
  ON leave_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
  ));

CREATE POLICY "Authenticated users can insert own leave requests"
  ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR and admin can update leave requests"
  ON leave_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')));

-- ── Leave Balances ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month int NOT NULL,
  year int NOT NULL,
  leaves_remaining int NOT NULL DEFAULT 2,
  wfh_remaining int NOT NULL DEFAULT 4,
  UNIQUE(user_id, month, year)
);

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leave balance"
  ON leave_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
  ));

CREATE POLICY "HR and admin can insert leave balances"
  ON leave_balances FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')
  ));

CREATE POLICY "HR and admin can update leave balances"
  ON leave_balances FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr')));

-- ── Level Thresholds ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS level_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_name text NOT NULL UNIQUE,
  min_pieces int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE level_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view level thresholds"
  ON level_thresholds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert level thresholds"
  ON level_thresholds FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update level thresholds"
  ON level_thresholds FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed default level thresholds
INSERT INTO level_thresholds (level_name, min_pieces) VALUES
  ('Rookie', 0), ('Novice', 50), ('Apprentice', 150), ('Performer', 300),
  ('Pro', 500), ('Specialist', 750), ('Expert', 1000), ('Veteran', 1500),
  ('Elite', 2000), ('Master', 2750), ('Champion', 3750), ('Grandmaster', 5000),
  ('Legend', 7000), ('Mythic', 10000), ('Immortal', 15000), ('GOAT', 25000)
ON CONFLICT (level_name) DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS attendance_logs_user_date_idx ON attendance_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS leave_requests_user_idx ON leave_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS late_cake_slices_cycle_idx ON late_cake_slices(cycle_id);
