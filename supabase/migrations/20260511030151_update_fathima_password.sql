/*
  # Update Fathima's password
  Her auth account already exists with fathimashameer886@gmail.com — just set a known password.
*/
UPDATE auth.users
SET
  encrypted_password = crypt('Fathima@123', gen_salt('bf')),
  updated_at = now()
WHERE id = 'e11b5bc5-d618-43a4-a37e-f8e53d046561';
