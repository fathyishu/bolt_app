/*
  # Fix staff auth accounts — correct emails and set passwords

  Existing auth.users already have the right UUIDs matching profiles.
  This migration updates emails to @mjsports.in and sets proper passwords.
  Fathima has no auth user yet — create one using her existing profile UUID.
*/

DO $$
BEGIN

  -- Shabeer: update email + password
  UPDATE auth.users
  SET
    email = 'shabeer@mjsports.in',
    encrypted_password = crypt('Shabeer@123', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now()
  WHERE id = 'a1000000-0000-0000-0000-000000000001';

  UPDATE auth.identities
  SET
    identity_data = jsonb_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'email', 'shabeer@mjsports.in'),
    provider_id = 'a1000000-0000-0000-0000-000000000001',
    updated_at = now()
  WHERE user_id = 'a1000000-0000-0000-0000-000000000001';

  -- Muhasana: update email + password
  UPDATE auth.users
  SET
    email = 'muhasana@mjsports.in',
    encrypted_password = crypt('Muhasana@123', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now()
  WHERE id = 'a1000000-0000-0000-0000-000000000002';

  UPDATE auth.identities
  SET
    identity_data = jsonb_build_object('sub', 'a1000000-0000-0000-0000-000000000002', 'email', 'muhasana@mjsports.in'),
    provider_id = 'a1000000-0000-0000-0000-000000000002',
    updated_at = now()
  WHERE user_id = 'a1000000-0000-0000-0000-000000000002';

  -- Rena: update email + password
  UPDATE auth.users
  SET
    email = 'rena@mjsports.in',
    encrypted_password = crypt('Rena@1234', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now()
  WHERE id = 'a1000000-0000-0000-0000-000000000003';

  UPDATE auth.identities
  SET
    identity_data = jsonb_build_object('sub', 'a1000000-0000-0000-0000-000000000003', 'email', 'rena@mjsports.in'),
    provider_id = 'a1000000-0000-0000-0000-000000000003',
    updated_at = now()
  WHERE user_id = 'a1000000-0000-0000-0000-000000000003';

  -- Nafla: update email + password
  UPDATE auth.users
  SET
    email = 'nafla@mjsports.in',
    encrypted_password = crypt('Nafla@1234', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now()
  WHERE id = 'a1000000-0000-0000-0000-000000000004';

  UPDATE auth.identities
  SET
    identity_data = jsonb_build_object('sub', 'a1000000-0000-0000-0000-000000000004', 'email', 'nafla@mjsports.in'),
    provider_id = 'a1000000-0000-0000-0000-000000000004',
    updated_at = now()
  WHERE user_id = 'a1000000-0000-0000-0000-000000000004';

  -- Sahal: update email + password
  UPDATE auth.users
  SET
    email = 'sahal@mjsports.in',
    encrypted_password = crypt('Sahal@1234', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now()
  WHERE id = '81d379ec-854b-418e-b110-711fd9b49107';

  UPDATE auth.identities
  SET
    identity_data = jsonb_build_object('sub', '81d379ec-854b-418e-b110-711fd9b49107', 'email', 'sahal@mjsports.in'),
    provider_id = '81d379ec-854b-418e-b110-711fd9b49107',
    updated_at = now()
  WHERE user_id = '81d379ec-854b-418e-b110-711fd9b49107';

  -- Fathima: no auth user exists yet — create with her existing profile UUID
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'e11b5bc5-d618-43a4-a37e-f8e53d046561') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      'e11b5bc5-d618-43a4-a37e-f8e53d046561',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'fathima@mjsports.in',
      crypt('Fathima@123', gen_salt('bf')),
      now(), now(), now(),
      '{"full_name":"Fathima Shameer"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'e11b5bc5-d618-43a4-a37e-f8e53d046561',
      jsonb_build_object('sub', 'e11b5bc5-d618-43a4-a37e-f8e53d046561', 'email', 'fathima@mjsports.in'),
      'email',
      'e11b5bc5-d618-43a4-a37e-f8e53d046561',
      now(), now(), now()
    );
  END IF;

END $$;
