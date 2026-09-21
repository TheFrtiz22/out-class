CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Safest domain restriction: Reject at the database level
  IF NEW.email NOT LIKE '%@virginia.edu' THEN
    RAISE EXCEPTION 'Only @virginia.edu email addresses are allowed';
  END IF;

  -- 2. Automatically sync Supabase Auth users to our Prisma User table
  INSERT INTO public."User" (id, email, role, "createdAt")
  VALUES (
    NEW.id::text, 
    NEW.email, 
    'STUDENT', 
    NEW.created_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists to allow safe re-runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on the Supabase auth schema
CREATE TRIGGER on_auth_user_created
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

