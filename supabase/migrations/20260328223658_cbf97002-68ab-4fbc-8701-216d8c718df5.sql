
-- Inspector profiles table
CREATE TABLE public.inspector_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  cities_ar text[] DEFAULT '{}',
  cities_en text[] DEFAULT '{}',
  regions_ar text[] DEFAULT '{}',
  regions_en text[] DEFAULT '{}',
  availability_status text NOT NULL DEFAULT 'available',
  max_concurrent_tasks integer DEFAULT 5,
  current_workload integer DEFAULT 0,
  specializations text[] DEFAULT '{}',
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.inspector_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inspector profiles" ON public.inspector_profiles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Inspectors view own profile" ON public.inspector_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Add assigned_inspector_id to valuation_assignments
ALTER TABLE public.valuation_assignments
  ADD COLUMN assigned_inspector_id uuid REFERENCES auth.users(id);

-- Inspector reassignment log
CREATE TABLE public.inspector_reassignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  previous_inspector_id uuid,
  new_inspector_id uuid NOT NULL,
  reason text,
  reassigned_by uuid NOT NULL,
  inspection_was_started boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspector_reassignment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reassignment log" ON public.inspector_reassignment_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Inspectors view own reassignments" ON public.inspector_reassignment_log
  FOR SELECT TO authenticated
  USING (previous_inspector_id = auth.uid() OR new_inspector_id = auth.uid());

-- Update trigger for inspector_profiles
CREATE TRIGGER update_inspector_profiles_updated_at
  BEFORE UPDATE ON public.inspector_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
