
-- Add manual payment fields to existing payments table
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS payment_proof_path text,
  ADD COLUMN IF NOT EXISTS bank_transfer_ref text,
  ADD COLUMN IF NOT EXISTS client_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Create payment-proofs storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can upload to their own folder
CREATE POLICY "Users upload payment proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can view their own proofs
CREATE POLICY "Users view own payment proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Owners/admins can view all proofs
CREATE POLICY "Admins view all payment proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'owner'));
