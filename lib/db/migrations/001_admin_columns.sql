-- Admin dashboard columns added to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro_override boolean NOT NULL DEFAULT false;
