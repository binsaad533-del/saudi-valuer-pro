-- Add unique constraint for user_id + role
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);

-- Insert roles for staff accounts
INSERT INTO public.user_roles (user_id, role)
VALUES 
  ('48d8a1d3-4320-4495-9f01-ed2cf1b64d9f', 'financial_manager'),
  ('cefc7107-1592-46ea-b36b-18aea2d9a1cf', 'inspector')
ON CONFLICT (user_id, role) DO NOTHING;