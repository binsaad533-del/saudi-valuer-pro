
CREATE OR REPLACE FUNCTION public.generate_reference_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  year_prefix TEXT;
  next_seq INTEGER;
BEGIN
  year_prefix := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(sequential_number), 0) + 1 INTO next_seq
  FROM public.valuation_assignments
  WHERE reference_number LIKE 'VAL-' || year_prefix || '-%';

  NEW.sequential_number := next_seq;
  NEW.reference_number := 'VAL-' || year_prefix || '-' || LPAD(next_seq::TEXT, 4, '0');
  NEW.qr_verification_code := encode(extensions.gen_random_bytes(16), 'hex');
  RETURN NEW;
END;
$function$;
