const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  try {
    const sql = fs.readFileSync('prisma/setup_auth_trigger.sql', 'utf-8');
    
    // We can't execute multiple statements easily with $executeRawUnsafe if they contain plpgsql blocks with $$ 
    // Wait, let's just use it and see.
    await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@virginia.edu' THEN
    RAISE EXCEPTION 'Only @virginia.edu email addresses are allowed';
  END IF;

  INSERT INTO public."User" (id, email, role, "createdAt")
  VALUES (
    NEW.id::text, 
    NEW.email, 
    'STUDENT', 
    NEW.created_at
  )
  ON CONFLICT (email) DO UPDATE 
  SET id = EXCLUDED.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log("Trigger function updated.");
  } catch(e) {
    console.error("Error:", e.message);
  }
}
main();
