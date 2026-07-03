/*
# Major Feature Update — Leads Schema, Soft Delete, EOD Timestamps, Closing Feed, Leave Archive

## Summary
This migration applies surgical additions across five areas to support the new feature set.

## 1. Leads Table Enhancements
- Adds `pre_booking` to the allowed lead status values.
- Adds `payment_type` column: 'prepaid' or 'cod' — categorises every lead by payment method.
- Adds `date_of_entry` date column — manually set entry timestamp per lead.
- Adds `follow_up_date` date column — mandatory date target for follow-up urgency sorting.
- Adds `date_of_closing`, `date_of_dispatch`, `date_of_delivery` date columns — COD-specific fulfilment tracking.

## 2. Profiles — Soft Delete Support
- Adds `is_active` boolean (default true) — set to false on deletion instead of hard-deleting the row.
- Adds `deleted_at` timestamptz — records when the soft-delete was performed.
- Preserves all historical cycle/leaderboard data while hiding the user from live views.

## 3. EOD Reports — Auditable Submit Timestamp
- Adds `submitted_at` timestamptz — set server-side (DEFAULT now()) and never overwritten by the client.
  Separates "report date" (user-controllable `date`) from "submitted at" (system-generated timestamp).

## 4. Closing News Feed — Pieces Count
- Adds `pieces_count` int to `closing_news_feed` so the ticker can broadcast deal size
  (e.g. "Shabeer just closed an order for 250 jerseys!").

## 5. Monthly Leave Archive Table
- New `monthly_leave_archives` table for HR "Close Month's Report" snapshots.
  Stores a JSONB snapshot of all leave balances so HR can reset allocations without losing history.
  RLS: readable + writable by admin, hr, manager roles only.
*/

-- ── 1. Leads: expand status CHECK constraint ─────────────────────────────────
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new_lead','follow_up','pre_booking',
    'dead_lead','bill_declined',
    'pending_payment','cod_lead','closed_lead'
  ));

-- ── 2. Leads: new columns ────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_type   text CHECK (payment_type IN ('prepaid','cod'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_of_entry  date DEFAULT CURRENT_DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_of_closing   date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_of_dispatch  date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_of_delivery  date;

-- ── 3. Profiles: soft delete columns ────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ── 4. EOD Reports: audit timestamp ─────────────────────────────────────────
ALTER TABLE eod_reports ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now();

-- ── 5. Closing news feed: pieces count ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'closing_news_feed' AND column_name = 'pieces_count'
  ) THEN
    ALTER TABLE closing_news_feed ADD COLUMN pieces_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── 6. Monthly leave archive ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_leave_archives (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month       int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        int  NOT NULL,
  archived_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  archived_at timestamptz DEFAULT now(),
  data        jsonb NOT NULL DEFAULT '[]'
);

ALTER TABLE monthly_leave_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_leave_archives" ON monthly_leave_archives;
CREATE POLICY "select_leave_archives" ON monthly_leave_archives FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')
  ));

DROP POLICY IF EXISTS "insert_leave_archives" ON monthly_leave_archives;
CREATE POLICY "insert_leave_archives" ON monthly_leave_archives FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')
  ));

DROP POLICY IF EXISTS "update_leave_archives" ON monthly_leave_archives;
CREATE POLICY "update_leave_archives" ON monthly_leave_archives FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')
  ));

DROP POLICY IF EXISTS "delete_leave_archives" ON monthly_leave_archives;
CREATE POLICY "delete_leave_archives" ON monthly_leave_archives FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr','manager')
  ));
