DROP POLICY IF EXISTS "Service role can insert payment failures" ON public.payment_failures;

CREATE POLICY "Admins can insert payment failures"
  ON public.payment_failures
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));