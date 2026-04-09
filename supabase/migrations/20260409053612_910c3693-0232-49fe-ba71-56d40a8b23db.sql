UPDATE valuation_requests 
SET inspection_type = ai_intake_summary->>'valuation_mode'
WHERE ai_intake_summary->>'valuation_mode' IS NOT NULL 
  AND ai_intake_summary->>'valuation_mode' != 'field'
  AND (inspection_type IS NULL OR inspection_type = 'field');