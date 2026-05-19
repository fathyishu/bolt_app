/*
  # Add team assignment to tasks

  1. Changes
    - Add `assign_to_team` boolean column to `tasks` (default false)
      - When true, the task is visible to every member of the team
  2. RLS updates
    - SELECT: also allow if assign_to_team = true (any authenticated user)
    - UPDATE: also allow if assign_to_team = true and user is authenticated
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assign_to_team'
  ) THEN
    ALTER TABLE tasks ADD COLUMN assign_to_team boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Drop and recreate SELECT policy to include team tasks
DROP POLICY IF EXISTS "Users can view tasks assigned to them or created by them" ON tasks;

CREATE POLICY "Users can view tasks assigned to them, team tasks, or admin"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    assign_to_team = true
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin', 'manager'])
    )
  );

-- Drop and recreate UPDATE policy to include team tasks
DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON tasks;

CREATE POLICY "Users can update tasks they created, are assigned to, team tasks, or admin"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assign_to_team = true
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin', 'manager'])
    )
  )
  WITH CHECK (
    assign_to_team = true
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin', 'manager'])
    )
  );
