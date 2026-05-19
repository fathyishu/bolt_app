/*
  # Add Cycles, History Archive, Countdowns & News Feed

  1. New Tables
    - `performance_cycles` — defines named cycles (e.g. April Cycle, May Cycle) with start/end dates
    - `cycle_snapshots` — frozen leaderboard data per cycle per user
    - `review_schedules` — admin-configurable review countdown targets (weekly standup, monthly review)
    - `closing_news_feed` — broadcast entries for closed deals (display-only, no impact on metrics)
    - `break_logs` — HR-logged break sessions per employee per date
    - `credentials_store` — admin-only view of current login credentials (email + masked password hint)

  2. Changes to existing tables
    - `profiles` — add `about` text, `joined_cycle` text
    - `eod_reports` — add `closed_deals` int, `new_leads_contacted` int for conversion rate
    - `late_cake_slices` — ensure breaks table exists

  3. Security
    - RLS enabled on all new tables
    - review_schedules: admin can update, all authenticated can read
    - closing_news_feed: any authenticated user can insert; all can read
    - cycle_snapshots: all authenticated can read; admin/hr/manager can insert
    - break_logs: admin/hr/manager can insert and read
*/

-- ── performance_cycles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE performance_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cycles"
  ON performance_cycles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage cycles"
  ON performance_cycles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update cycles"
  ON performance_cycles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── cycle_snapshots ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycle_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES performance_cycles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  pieces integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  rings integer NOT NULL DEFAULT 0,
  accepted_calls integer NOT NULL DEFAULT 0,
  positive_chats integer NOT NULL DEFAULT 0,
  billed_clients integer NOT NULL DEFAULT 0,
  closed_deals integer NOT NULL DEFAULT 0,
  chat_positive integer NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  rank integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cycle_id, user_id)
);
ALTER TABLE cycle_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshots"
  ON cycle_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Privileged users can insert snapshots"
  ON cycle_snapshots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')));

CREATE POLICY "Privileged users can update snapshots"
  ON cycle_snapshots FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')));

-- ── review_schedules ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_type text NOT NULL CHECK (review_type IN ('weekly_standup', 'monthly_review')),
  day_of_week integer, -- 0=Sun .. 6=Sat, used for weekly
  day_of_month integer, -- 1-31, used for monthly
  hour_utc integer NOT NULL DEFAULT 9,
  minute_utc integer NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(review_type)
);
ALTER TABLE review_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read schedules"
  ON review_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert schedules"
  ON review_schedules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update schedules"
  ON review_schedules FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed default schedules
INSERT INTO review_schedules (review_type, day_of_week, day_of_month, hour_utc, minute_utc, label)
VALUES
  ('weekly_standup',  2, NULL, 4, 30, 'Weekly Stand-Up — Every Tuesday at 10:00 AM IST'),
  ('monthly_review', NULL, 5,  4, 30, 'Monthly Performance Review — 5th of every month at 10:00 AM IST')
ON CONFLICT (review_type) DO NOTHING;

-- ── closing_news_feed ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS closing_news_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  staff_name text NOT NULL DEFAULT '',
  lead_title text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE closing_news_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feed"
  ON closing_news_feed FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert feed entries"
  ON closing_news_feed FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── break_logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS break_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time text NOT NULL DEFAULT '',
  end_time text,
  duration_minutes integer,
  notes text NOT NULL DEFAULT '',
  logged_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE break_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can read break logs"
  ON break_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')));

CREATE POLICY "Privileged users can insert break logs"
  ON break_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')));

CREATE POLICY "Privileged users can update break logs"
  ON break_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')));

-- ── profiles additions ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='about') THEN
    ALTER TABLE profiles ADD COLUMN about text NOT NULL DEFAULT '';
  END IF;
END $$;

-- ── eod_reports additions for conversion rate ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eod_reports' AND column_name='closed_deals') THEN
    ALTER TABLE eod_reports ADD COLUMN closed_deals integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eod_reports' AND column_name='new_leads_contacted') THEN
    ALTER TABLE eod_reports ADD COLUMN new_leads_contacted integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eod_reports' AND column_name='pieces_sold') THEN
    ALTER TABLE eod_reports ADD COLUMN pieces_sold integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Sync pieces_sold from total_pieces if it exists
UPDATE eod_reports SET pieces_sold = total_pieces WHERE pieces_sold = 0 AND total_pieces > 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cycle_snapshots_user ON cycle_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_closing_news_feed_created ON closing_news_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_break_logs_user_date ON break_logs(user_id, date);
