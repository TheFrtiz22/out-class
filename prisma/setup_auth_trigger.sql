CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Safest domain restriction: Reject at the database level
  -- Normalize email before check
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  NEW.email := lower(trim(NEW.email));

  IF NEW.email !~* '^[a-z0-9]+([._+-][a-z0-9]+)*@virginia\.edu$' THEN
    RAISE EXCEPTION 'Only @virginia.edu email addresses are allowed';
  END IF;

  -- Email is not an identity key. Preserve public-only records and reject
  -- signup collisions rather than moving their PK (and cascading relations).
  IF EXISTS (
    SELECT 1 FROM public."User"
    WHERE lower(trim(email)) = NEW.email AND id <> NEW.id::text
  ) THEN
    RAISE EXCEPTION 'Email belongs to a different public user; manual identity review required';
  END IF;

  -- Sync only the same Auth ID. The unique email constraint also rejects races.
  -- Never update public.User.id or create replacement credential storage.
  INSERT INTO public."User" (id, email, role, "createdAt")
  VALUES (
    NEW.id::text, 
    NEW.email, 
    'STUDENT'::public."AppRole", 
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Drop trigger if it already exists to allow safe re-runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on the Supabase auth schema
CREATE TRIGGER on_auth_user_created
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
