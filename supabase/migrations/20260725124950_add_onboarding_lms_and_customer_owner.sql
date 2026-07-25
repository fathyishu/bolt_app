/*
# Add Onboarding Lock, 3-Tier LMS Architecture & Customer Ownership

Strictly additive: no existing tables/columns/policies are altered or dropped.
Adds onboarding lock state, full 3-tier LMS hierarchy, gamification badges,
onboarding threshold settings, customer ownership column, and an lms-assets bucket.

## profiles
- is_onboarding_complete boolean default false: gates all tabs except Training.

## customers
- owner_id uuid nullable: ownership for Admin Reassign Customer. Backfilled to added_by.

## New LMS tables
- lms_categories, lms_courses, lms_modules, lms_lessons (dual video + asset + unskippable + reflection),
- lms_checkpoints (in-video quizzes), lms_checkpoint_answers,
- lms_flashcards (objection flip-cards), lms_lesson_progress (completion/time/reflection/score),
- lms_badges, lms_user_badges, lms_onboarding_settings (threshold singleton).

## Storage
- Bucket lms-assets: authenticated read; admin/hr/manager write.

## RLS
- Content tables: SELECT all authenticated; write admin/hr/manager (via profiles.role).
- Progress/answers/user-badges: owner read/write own; admin/hr/manager read all; badges awarded by admin/hr/manager.
- Storage: authenticated read; admin/hr/manager write.

## Idempotency
- CREATE TABLE IF NOT EXISTS; column adds guarded with DO $$ IF NOT EXISTS; policies dropped before recreate.
*/

-- profiles.is_onboarding_complete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'is_onboarding_complete'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_onboarding_complete boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- customers.owner_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN owner_id uuid;
    UPDATE customers SET owner_id = added_by WHERE owner_id IS NULL;
  END IF;
END $$;

-- lms_categories
CREATE TABLE IF NOT EXISTS lms_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lms_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_cat_select" ON lms_categories;
CREATE POLICY "lms_cat_select" ON lms_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lms_cat_insert" ON lms_categories;
CREATE POLICY "lms_cat_insert" ON lms_categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_cat_update" ON lms_categories;
CREATE POLICY "lms_cat_update" ON lms_categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_cat_delete" ON lms_categories;
CREATE POLICY "lms_cat_delete" ON lms_categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_courses
CREATE TABLE IF NOT EXISTS lms_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES lms_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_course_select" ON lms_courses;
CREATE POLICY "lms_course_select" ON lms_courses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lms_course_insert" ON lms_courses;
CREATE POLICY "lms_course_insert" ON lms_courses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_course_update" ON lms_courses;
CREATE POLICY "lms_course_update" ON lms_courses FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_course_delete" ON lms_courses;
CREATE POLICY "lms_course_delete" ON lms_courses FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_modules
CREATE TABLE IF NOT EXISTS lms_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lms_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_mod_select" ON lms_modules;
CREATE POLICY "lms_mod_select" ON lms_modules FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lms_mod_insert" ON lms_modules;
CREATE POLICY "lms_mod_insert" ON lms_modules FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_mod_update" ON lms_modules;
CREATE POLICY "lms_mod_update" ON lms_modules FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_mod_delete" ON lms_modules;
CREATE POLICY "lms_mod_delete" ON lms_modules FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_lessons
CREATE TABLE IF NOT EXISTS lms_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES lms_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  content_kind text NOT NULL DEFAULT 'video' CHECK (content_kind IN ('video','asset','text','interactive')),
  video_url text NOT NULL DEFAULT '',
  video_storage_path text,
  video_duration_sec integer NOT NULL DEFAULT 0,
  unskippable boolean NOT NULL DEFAULT false,
  asset_url text,
  asset_storage_path text,
  asset_type text CHECK (asset_type IS NULL OR asset_type IN ('pdf','mp3','image')),
  reflection_prompt text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lms_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_lesson_select" ON lms_lessons;
CREATE POLICY "lms_lesson_select" ON lms_lessons FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lms_lesson_insert" ON lms_lessons;
CREATE POLICY "lms_lesson_insert" ON lms_lessons FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_lesson_update" ON lms_lessons;
CREATE POLICY "lms_lesson_update" ON lms_lessons FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_lesson_delete" ON lms_lessons;
CREATE POLICY "lms_lesson_delete" ON lms_lessons FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_checkpoints
CREATE TABLE IF NOT EXISTS lms_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lms_lessons(id) ON DELETE CASCADE,
  timestamp_sec integer NOT NULL DEFAULT 0,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_option_index integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE lms_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_chk_select" ON lms_checkpoints;
CREATE POLICY "lms_chk_select" ON lms_checkpoints FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lms_chk_insert" ON lms_checkpoints;
CREATE POLICY "lms_chk_insert" ON lms_checkpoints FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_chk_update" ON lms_checkpoints;
CREATE POLICY "lms_chk_update" ON lms_checkpoints FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_chk_delete" ON lms_checkpoints;
CREATE POLICY "lms_chk_delete" ON lms_checkpoints FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_checkpoint_answers
CREATE TABLE IF NOT EXISTS lms_checkpoint_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL REFERENCES lms_checkpoints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  selected_index integer NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lms_checkpoint_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_ans_select" ON lms_checkpoint_answers;
CREATE POLICY "lms_ans_select" ON lms_checkpoint_answers FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_ans_insert" ON lms_checkpoint_answers;
CREATE POLICY "lms_ans_insert" ON lms_checkpoint_answers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lms_ans_update" ON lms_checkpoint_answers;
CREATE POLICY "lms_ans_update" ON lms_checkpoint_answers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lms_ans_delete" ON lms_checkpoint_answers;
CREATE POLICY "lms_ans_delete" ON lms_checkpoint_answers FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_flashcards
CREATE TABLE IF NOT EXISTS lms_flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lms_lessons(id) ON DELETE CASCADE,
  front_text text NOT NULL,
  back_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE lms_flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_fc_select" ON lms_flashcards;
CREATE POLICY "lms_fc_select" ON lms_flashcards FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lms_fc_insert" ON lms_flashcards;
CREATE POLICY "lms_fc_insert" ON lms_flashcards FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_fc_update" ON lms_flashcards;
CREATE POLICY "lms_fc_update" ON lms_flashcards FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_fc_delete" ON lms_flashcards;
CREATE POLICY "lms_fc_delete" ON lms_flashcards FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_lesson_progress
CREATE TABLE IF NOT EXISTS lms_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lms_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  time_spent_sec integer NOT NULL DEFAULT 0,
  video_position_sec integer NOT NULL DEFAULT 0,
  reflection_text text NOT NULL DEFAULT '',
  quiz_score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);
ALTER TABLE lms_lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_prog_select" ON lms_lesson_progress;
CREATE POLICY "lms_prog_select" ON lms_lesson_progress FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_prog_insert" ON lms_lesson_progress;
CREATE POLICY "lms_prog_insert" ON lms_lesson_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lms_prog_update" ON lms_lesson_progress;
CREATE POLICY "lms_prog_update" ON lms_lesson_progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lms_prog_delete" ON lms_lesson_progress;
CREATE POLICY "lms_prog_delete" ON lms_lesson_progress FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_badges
CREATE TABLE IF NOT EXISTS lms_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🏅',
  course_id uuid REFERENCES lms_courses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lms_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_badge_select" ON lms_badges;
CREATE POLICY "lms_badge_select" ON lms_badges FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lms_badge_insert" ON lms_badges;
CREATE POLICY "lms_badge_insert" ON lms_badges FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_badge_update" ON lms_badges;
CREATE POLICY "lms_badge_update" ON lms_badges FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_badge_delete" ON lms_badges;
CREATE POLICY "lms_badge_delete" ON lms_badges FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_user_badges
CREATE TABLE IF NOT EXISTS lms_user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid NOT NULL REFERENCES lms_badges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (badge_id, user_id)
);
ALTER TABLE lms_user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_ub_select" ON lms_user_badges;
CREATE POLICY "lms_ub_select" ON lms_user_badges FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_ub_insert" ON lms_user_badges;
CREATE POLICY "lms_ub_insert" ON lms_user_badges FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_ub_delete" ON lms_user_badges;
CREATE POLICY "lms_ub_delete" ON lms_user_badges FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- lms_onboarding_settings (singleton)
CREATE TABLE IF NOT EXISTS lms_onboarding_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  required_days integer NOT NULL DEFAULT 0,
  required_course_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lms_onboarding_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_os_select" ON lms_onboarding_settings;
CREATE POLICY "lms_os_select" ON lms_onboarding_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lms_os_insert" ON lms_onboarding_settings;
CREATE POLICY "lms_os_insert" ON lms_onboarding_settings FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_os_update" ON lms_onboarding_settings;
CREATE POLICY "lms_os_update" ON lms_onboarding_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_os_delete" ON lms_onboarding_settings;
CREATE POLICY "lms_os_delete" ON lms_onboarding_settings FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- Storage bucket: lms-assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('lms-assets', 'lms-assets', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lms_assets_read" ON storage.objects;
CREATE POLICY "lms_assets_read" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'lms-assets');

DROP POLICY IF EXISTS "lms_assets_insert" ON storage.objects;
CREATE POLICY "lms_assets_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'lms-assets'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_assets_update" ON storage.objects;
CREATE POLICY "lms_assets_update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'lms-assets'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  ) WITH CHECK (
    bucket_id = 'lms-assets'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

DROP POLICY IF EXISTS "lms_assets_delete" ON storage.objects;
CREATE POLICY "lms_assets_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'lms-assets'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','hr','manager'))
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lms_courses_category ON lms_courses(category_id);
CREATE INDEX IF NOT EXISTS idx_lms_modules_course ON lms_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_lessons_module ON lms_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lms_checkpoints_lesson ON lms_checkpoints(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lms_flashcards_lesson ON lms_flashcards(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lms_progress_lesson_user ON lms_lesson_progress(lesson_id, user_id);
CREATE INDEX IF NOT EXISTS idx_lms_progress_user ON lms_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lms_user_badges_user ON lms_user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
