/*
  # MJ Sports CRM - Core Schema

  ## Overview
  Creates the foundational tables for the MJ Sports Sales CRM including:
  - profiles: Extended user data with roles, stats, and gamification fields
  - leads: Full CRM lead tracking with status, payment, and commission data
  - eod_reports: End-of-Day reporting submissions
  - tasks: Kanban task board items
  - trophy_case: Archived monthly stats for historical records

  ## Tables

  ### profiles
  - id (uuid, FK to auth.users)
  - full_name, avatar_url, role (admin/manager/sales_executive)
  - lifetime_pieces, monthly_pieces, current_streak
  - last_eod_date (for streak calculation)
  - sunday_super_streak (boolean flag for Sunday sales animation)
  - manager_daily_target (int, set by managers for ghost values)

  ### leads
  - id, title, contact_name, phone, email
  - status (new_lead/follow_up/dead_lead/bill_declined/pending_payment/cod_lead/closed_lead)
  - pieces_count, next_payment_date, last_follow_up
  - assigned_to (FK to profiles)
  - notes

  ### eod_reports
  - user_id, date, rings_prev, rings_new, accepted_calls, positive_chats
  - billed_clients, total_pieces, daily_notes

  ### tasks
  - id, title, description, status (todo/in_progress/done)
  - assigned_to, created_by, due_date, priority

  ### trophy_case
  - user_id, month, year, pieces, rank, archived_at

  ## Security
  - RLS enabled on all tables
  - Roles enforced: admins can manage all, managers can read all + set targets, sales_execs own their data
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  role text NOT NULL DEFAULT 'sales_executive' CHECK (role IN ('admin', 'manager', 'sales_executive')),
  lifetime_pieces int NOT NULL DEFAULT 0,
  monthly_pieces int NOT NULL DEFAULT 0,
  current_streak int NOT NULL DEFAULT 0,
  last_eod_date date,
  sunday_super_streak boolean NOT NULL DEFAULT false,
  manager_daily_target int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow admins to update any profile (for streak pardon, role changes, etc.)
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  status text NOT NULL DEFAULT 'new_lead' CHECK (status IN ('new_lead','follow_up','dead_lead','bill_declined','pending_payment','cod_lead','closed_lead')),
  pieces_count int NOT NULL DEFAULT 0,
  next_payment_date date,
  last_follow_up timestamptz,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales execs can view own leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Sales execs can insert own leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Sales execs can update own leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- EOD Reports table
CREATE TABLE IF NOT EXISTS eod_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  rings_prev int NOT NULL DEFAULT 0,
  rings_new int NOT NULL DEFAULT 0,
  accepted_calls int NOT NULL DEFAULT 0,
  positive_chats int NOT NULL DEFAULT 0,
  billed_clients int NOT NULL DEFAULT 0,
  total_pieces int NOT NULL DEFAULT 0,
  daily_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE eod_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own EOD reports"
  ON eod_reports FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Users can insert own EOD reports"
  ON eod_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own EOD reports"
  ON eod_reports FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks assigned to them or created by them"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Users can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update tasks they created or are assigned to"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admins and creators can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Trophy Case table
CREATE TABLE IF NOT EXISTS trophy_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL,
  pieces int NOT NULL DEFAULT 0,
  rank int,
  archived_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE trophy_case ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trophy case"
  ON trophy_case FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admins can insert trophy case entries"
  ON trophy_case FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
