
-- Add national_id to profiles for staff lookup
ALTER TABLE public.profiles ADD COLUMN national_id TEXT UNIQUE;

-- Create index for fast lookup
CREATE INDEX idx_profiles_national_id ON public.profiles (national_id);
