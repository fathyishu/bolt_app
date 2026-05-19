/*
  # Seed April Cycle & Initialize May Cycle

  1. Creates "April Cycle" (Apr 10 - May 10) performance_cycle record
  2. Creates "May Cycle" (May 11 - Jun 5) as the active cycle
  3. Seeds April cycle_snapshots for all 6 reps using pre-verified data
  4. Sets lifetime_pieces from April data for each rep
  5. Resets monthly_pieces to 0 for the new May cycle

  April Data (pre-verified):
    Shabeer:   1779p, 150 leads, 2457 rings, 861 accepted, 46 positive, 40 billed, 26 closed, 95 chat_positive
    Fathima:   722p,  318 leads,  259 rings, 120 accepted, 71 positive, 31 billed, 23 closed, 29 chat_positive
    Rena:      720p,  273 leads,  457 rings,  68 accepted, 87 positive, 28 billed, 23 closed, 85 chat_positive
    Muhsana:   651p,  660 leads, 4502 rings, 176 accepted, 80 positive, 23 billed, 20 closed, 48 chat_positive
    Sahal:     525p,  332 leads,    0 rings,  14 accepted, 87 positive, 30 billed, 22 closed, 96 chat_positive
    Nafla:     260p,  117 leads,  331 rings,  96 accepted, 75 positive,  9 billed,  9 closed, 47 chat_positive
*/

-- 1. Insert cycles
INSERT INTO performance_cycles (name, start_date, end_date, is_active)
VALUES
  ('April Cycle', '2026-04-10', '2026-05-10', false),
  ('May Cycle',   '2026-05-11', '2026-06-05', true)
ON CONFLICT DO NOTHING;

-- 2. Snapshot April data — we join by full_name (case-insensitive) to get UUIDs
DO $$
DECLARE
  april_cycle_id uuid;
  v_user_id uuid;
BEGIN
  SELECT id INTO april_cycle_id FROM performance_cycles WHERE name = 'April Cycle' LIMIT 1;
  IF april_cycle_id IS NULL THEN RETURN; END IF;

  -- Shabeer
  SELECT id INTO v_user_id FROM profiles WHERE lower(full_name) LIKE '%shabeer%' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO cycle_snapshots
      (cycle_id, user_id, full_name, pieces, leads, rings, accepted_calls, positive_chats, billed_clients, closed_deals, chat_positive, commission, rank)
    VALUES
      (april_cycle_id, v_user_id, 'Shabeer', 1779, 150, 2457, 861, 46, 40, 26, 95, 1779*8, 1)
    ON CONFLICT (cycle_id, user_id) DO UPDATE SET
      pieces=1779, leads=150, rings=2457, accepted_calls=861, positive_chats=46, billed_clients=40, closed_deals=26, chat_positive=95, commission=1779*8, rank=1;
    UPDATE profiles SET lifetime_pieces = GREATEST(lifetime_pieces, 1779) WHERE id = v_user_id;
  END IF;

  -- Fathima
  SELECT id INTO v_user_id FROM profiles WHERE lower(full_name) LIKE '%fathima%' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO cycle_snapshots
      (cycle_id, user_id, full_name, pieces, leads, rings, accepted_calls, positive_chats, billed_clients, closed_deals, chat_positive, commission, rank)
    VALUES
      (april_cycle_id, v_user_id, 'Fathima', 722, 318, 259, 120, 71, 31, 23, 29, 722*8, 2)
    ON CONFLICT (cycle_id, user_id) DO UPDATE SET
      pieces=722, leads=318, rings=259, accepted_calls=120, positive_chats=71, billed_clients=31, closed_deals=23, chat_positive=29, commission=722*8, rank=2;
    UPDATE profiles SET lifetime_pieces = GREATEST(lifetime_pieces, 722) WHERE id = v_user_id;
  END IF;

  -- Rena
  SELECT id INTO v_user_id FROM profiles WHERE lower(full_name) LIKE '%rena%' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO cycle_snapshots
      (cycle_id, user_id, full_name, pieces, leads, rings, accepted_calls, positive_chats, billed_clients, closed_deals, chat_positive, commission, rank)
    VALUES
      (april_cycle_id, v_user_id, 'Rena', 720, 273, 457, 68, 87, 28, 23, 85, 720*8, 3)
    ON CONFLICT (cycle_id, user_id) DO UPDATE SET
      pieces=720, leads=273, rings=457, accepted_calls=68, positive_chats=87, billed_clients=28, closed_deals=23, chat_positive=85, commission=720*8, rank=3;
    UPDATE profiles SET lifetime_pieces = GREATEST(lifetime_pieces, 720) WHERE id = v_user_id;
  END IF;

  -- Muhsana / Muhasana
  SELECT id INTO v_user_id FROM profiles WHERE lower(full_name) LIKE '%muhs%' OR lower(full_name) LIKE '%muhas%' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO cycle_snapshots
      (cycle_id, user_id, full_name, pieces, leads, rings, accepted_calls, positive_chats, billed_clients, closed_deals, chat_positive, commission, rank)
    VALUES
      (april_cycle_id, v_user_id, 'Muhsana', 651, 660, 4502, 176, 80, 23, 20, 48, 651*8, 4)
    ON CONFLICT (cycle_id, user_id) DO UPDATE SET
      pieces=651, leads=660, rings=4502, accepted_calls=176, positive_chats=80, billed_clients=23, closed_deals=20, chat_positive=48, commission=651*8, rank=4;
    UPDATE profiles SET lifetime_pieces = GREATEST(lifetime_pieces, 651) WHERE id = v_user_id;
  END IF;

  -- Sahal
  SELECT id INTO v_user_id FROM profiles WHERE lower(full_name) LIKE '%sahal%' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO cycle_snapshots
      (cycle_id, user_id, full_name, pieces, leads, rings, accepted_calls, positive_chats, billed_clients, closed_deals, chat_positive, commission, rank)
    VALUES
      (april_cycle_id, v_user_id, 'Sahal', 525, 332, 0, 14, 87, 30, 22, 96, 525*8, 5)
    ON CONFLICT (cycle_id, user_id) DO UPDATE SET
      pieces=525, leads=332, rings=0, accepted_calls=14, positive_chats=87, billed_clients=30, closed_deals=22, chat_positive=96, commission=525*8, rank=5;
    UPDATE profiles SET lifetime_pieces = GREATEST(lifetime_pieces, 525) WHERE id = v_user_id;
  END IF;

  -- Nafla
  SELECT id INTO v_user_id FROM profiles WHERE lower(full_name) LIKE '%nafla%' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO cycle_snapshots
      (cycle_id, user_id, full_name, pieces, leads, rings, accepted_calls, positive_chats, billed_clients, closed_deals, chat_positive, commission, rank)
    VALUES
      (april_cycle_id, v_user_id, 'Nafla', 260, 117, 331, 96, 75, 9, 9, 47, 260*8, 6)
    ON CONFLICT (cycle_id, user_id) DO UPDATE SET
      pieces=260, leads=117, rings=331, accepted_calls=96, positive_chats=75, billed_clients=9, closed_deals=9, chat_positive=47, commission=260*8, rank=6;
    UPDATE profiles SET lifetime_pieces = GREATEST(lifetime_pieces, 260) WHERE id = v_user_id;
  END IF;

END $$;

-- 3. Reset monthly_pieces to 0 for May cycle start
-- Only reset if monthly_pieces reflects April data (i.e., no May EODs verified yet)
-- We do this safely: set monthly_pieces to sum of verified EOD pieces after May 11
UPDATE profiles
SET monthly_pieces = (
  SELECT COALESCE(SUM(COALESCE(pieces_sold, total_pieces, 0)), 0)
  FROM eod_reports
  WHERE eod_reports.user_id = profiles.id
    AND eod_reports.status = 'verified'
    AND eod_reports.date >= '2026-05-11'
);
