-- Add inspector-specific RLS policy for inspections table
-- Inspectors should be able to SELECT and UPDATE their own inspections
CREATE POLICY "Inspectors access own inspections"
ON public.inspections
FOR ALL
TO authenticated
USING (inspector_id = auth.uid())
WITH CHECK (inspector_id = auth.uid());