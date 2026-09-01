/*
# Add EOD report metrics and lead counters

1. New columns on eod_reports (10 new metric fields):
- total_leads (integer, default 0) — total leads handled in the day
- new_leads (integer, default 0) — new leads created that day
- avg_response_time_min (integer, default 0) — average response time in minutes
- sample_orders (integer, default 0) — sample orders dispatched
- samples_converted (integer, default 0) — samples that converted to orders
- all_chats_cleared (boolean, default false) — whether all WhatsApp chats were cleared
- total_current_bills (numeric, default 0) — total current outstanding bills amount
- new_billed_today (numeric, default 0) — new billing done today
- pending_bills (numeric, default 0) — pending bill amount
- repeat_clients_count (integer, default 0) — number of repeat clients

2. New columns on profiles (lead counters):
- lifetime_leads (integer, default 0) — total leads created across all time
- monthly_leads (integer, default 0) — leads created this month

3. Security
- No new tables created; existing RLS policies on eod_reports and profiles remain unchanged.
- No policy changes needed — new columns inherit existing table-level access control.

4. Important notes
- All new columns have safe defaults so existing rows and queries continue working.
- monthly_leads reset will be handled manually (same pattern as monthly_pieces).
- No data migration needed — defaults populate existing rows automatically.
*/

ALTER TABLE eod_reports
  ADD COLUMN IF NOT EXISTS total_leads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_leads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_response_time_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sample_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS samples_converted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_chats_cleared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_current_bills numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_billed_today numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_bills numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_clients_count integer NOT NULL DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lifetime_leads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_leads integer NOT NULL DEFAULT 0;