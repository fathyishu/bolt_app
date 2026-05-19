/*
  # Fix handle_new_user trigger function

  ## Problem
  The "Database error saving new user" on signup is caused by the SECURITY DEFINER
  function not having an explicit search_path set. Supabase requires SECURITY DEFINER
  functions to set search_path = '' and use fully-qualified table names to prevent
  privilege escalation — without this, the function can fail silently at signup time.

  ## Changes
  - Recreate handle_new_user() with SET search_path = '' and fully-qualified table reference
  - Recreate the trigger to ensure it points to the updated function
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
