
-- Executive Memory Profiles — persistent AI personalization per user
CREATE TABLE public.executive_memory_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name_ar TEXT,
  display_name_en TEXT,
  role_title_ar TEXT,
  role_title_en TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'ar',
  communication_style JSONB NOT NULL DEFAULT '{}'::jsonb,
  behavior_directives TEXT[] NOT NULL DEFAULT '{}',
  context_rules TEXT[] NOT NULL DEFAULT '{}',
  domain_context TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.executive_memory_profiles ENABLE ROW LEVEL SECURITY;

-- Each user can only read their own profile
CREATE POLICY "Users can view own memory profile"
  ON public.executive_memory_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Each user can insert their own profile
CREATE POLICY "Users can create own memory profile"
  ON public.executive_memory_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Each user can update their own profile
CREATE POLICY "Users can update own memory profile"
  ON public.executive_memory_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can read any profile (for edge functions)
CREATE POLICY "Service role can read all memory profiles"
  ON public.executive_memory_profiles FOR SELECT
  TO service_role
  USING (true);

-- Auto-update timestamp
CREATE TRIGGER update_executive_memory_profiles_updated_at
  BEFORE UPDATE ON public.executive_memory_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
