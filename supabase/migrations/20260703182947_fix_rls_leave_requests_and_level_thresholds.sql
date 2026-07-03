-- Fix leave_requests INSERT policy: allow HR/admin/manager to insert for any user
DROP POLICY IF EXISTS "Authenticated users can insert own leave requests" ON leave_requests;

CREATE POLICY "Users can insert leave requests"
  ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
    )
  );

-- Fix level_thresholds INSERT policy: allow admin and manager
DROP POLICY IF EXISTS "Admin can insert level thresholds" ON level_thresholds;

CREATE POLICY "Admin can insert level thresholds"
  ON level_thresholds FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

-- Fix level_thresholds UPDATE policy: allow admin and manager
DROP POLICY IF EXISTS "Admin can update level thresholds" ON level_thresholds;

CREATE POLICY "Admin can update level thresholds"
  ON level_thresholds FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Fix leave_balances INSERT to also allow users to auto-initialize their own balance
DROP POLICY IF EXISTS "HR and admin can insert leave balances" ON leave_balances;

CREATE POLICY "HR and admin can insert leave balances"
  ON leave_balances FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
    )
  );

-- Fix leave_balances UPDATE to allow manager too
DROP POLICY IF EXISTS "HR and admin can update leave balances" ON leave_balances;

CREATE POLICY "HR and admin can update leave balances"
  ON leave_balances FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager'))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager'))
  );
