
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'data_collection_open' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'data_collection_open';
  END IF;
END$$;
