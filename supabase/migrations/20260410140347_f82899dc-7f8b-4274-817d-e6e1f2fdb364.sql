
CREATE TABLE public.secure_download_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  report_id text NOT NULL,
  file_path text,
  expires_at timestamptz NOT NULL,
  max_downloads integer NOT NULL DEFAULT 1,
  download_count integer NOT NULL DEFAULT 0,
  is_revoked boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.secure_download_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens"
  ON public.secure_download_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert tokens"
  ON public.secure_download_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_tokens_token ON public.secure_download_tokens (token);
CREATE INDEX idx_tokens_expires ON public.secure_download_tokens (expires_at);

CREATE OR REPLACE FUNCTION public.validate_download_token(_token text)
RETURNS TABLE(
  is_valid boolean,
  user_id uuid,
  report_id text,
  file_path text,
  rejection_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rec record;
BEGIN
  SELECT * INTO _rec FROM public.secure_download_tokens t WHERE t.token = _token LIMIT 1;

  IF _rec IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, 'رمز التحميل غير صالح'::text;
    RETURN;
  END IF;

  IF _rec.is_revoked THEN
    RETURN QUERY SELECT false, _rec.user_id, _rec.report_id, _rec.file_path, 'تم إلغاء صلاحية هذا الرابط'::text;
    RETURN;
  END IF;

  IF _rec.expires_at < now() THEN
    RETURN QUERY SELECT false, _rec.user_id, _rec.report_id, _rec.file_path, 'انتهت صلاحية رابط التحميل'::text;
    RETURN;
  END IF;

  IF _rec.download_count >= _rec.max_downloads THEN
    RETURN QUERY SELECT false, _rec.user_id, _rec.report_id, _rec.file_path, 'تم استنفاد عدد التحميلات المسموحة'::text;
    RETURN;
  END IF;

  UPDATE public.secure_download_tokens SET download_count = download_count + 1 WHERE id = _rec.id;

  RETURN QUERY SELECT true, _rec.user_id, _rec.report_id, _rec.file_path, NULL::text;
END;
$$;
