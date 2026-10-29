-- PROPOSED FIXES — FOR REVIEW. Nothing here has been run. Do not execute without reviewing.
-- Found while auditing supabase/schema.sql (not changed in the schema file itself).

-- 1) A signed-in customer can currently INSERT a prescription_requests row with any status
--    (e.g. 'approved'), any pharmacist_note, and any private_object_path, because the insert
--    policy only checks customer_user_id. The upload Edge Function uses the service role, so
--    customers do not need direct insert at all. Safest option: remove the direct insert policy.
drop policy if exists "customers create own prescription requests" on public.prescription_requests;
-- If you later want direct inserts from the browser, use a restrictive version instead:
-- create policy "customers create own prescription requests" on public.prescription_requests
--   for insert to authenticated
--   with check (customer_user_id = auth.uid()
--     and status = 'awaiting_pharmacist_review' and pharmacist_note = '' and reviewed_at is null
--     and private_object_path like auth.uid()::text || '/%');

-- 2) Optional: the public products policy exposes every column, including exact stock_quantity,
--    to anyone with the public key. If you prefer not to publish exact stock levels, create a
--    view with only the columns the storefront needs and point the storefront at it
--    (js/edp-premium.js already selects only id,name,description,category,price_ngn,
--    requires_prescription,image_url).
-- create view public.products_public with (security_invoker = true) as
--   select id,name,slug,description,category,price_ngn,requires_prescription,image_url
--   from public.products where active = true and pharmacist_approved = true;
