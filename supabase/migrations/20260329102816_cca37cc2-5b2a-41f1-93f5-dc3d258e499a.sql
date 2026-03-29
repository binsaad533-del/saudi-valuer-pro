-- Add client classification fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS client_value_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_category text DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS client_category_manual boolean DEFAULT false;
