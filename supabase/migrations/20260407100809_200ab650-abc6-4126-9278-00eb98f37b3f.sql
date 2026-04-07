
UPDATE public.valuation_assignments 
SET status = 'data_collection_open' 
WHERE status = 'data_collection';
