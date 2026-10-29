# E-Drug Planet Pharmacy — backend foundation

This package adds the first backend foundation to the existing storefront: a Supabase schema, secure-by-default row-level security policies, private prescription storage, an admin dashboard, and server-side functions for validating orders and handling prescription uploads.

**It is not live yet.** It needs a Supabase project, configuration, deployment, testing, and review by the pharmacy before real customers use it. The storefront still shows category enquiry cards until the product catalogue and checkout are connected to the database in the next integration pass.

## Included

- `index.html` — current storefront prototype
- `css/edp-motion.css`, `js/edp-motion.js` — animation layer
- `admin.html` — staff login, product management, order status management, prescription-request metadata
- `js/supabase-config.js` — public project configuration placeholders
- `supabase/schema.sql` — tables, RLS policies, and private `prescriptions` bucket
- `supabase/functions/create-order/index.ts` — server-side order validation and order record creation; does not collect payment
- `supabase/functions/prescription-upload/index.ts` — authenticated upload to private storage

## Backend choices

- **Database and staff authentication:** Supabase.
- **Payment:** intentionally not integrated. Orders are marked `not_paid` and `pending_confirmation`; staff confirm stock, branch, delivery fee and payment method with the customer. This matches the instruction that customers should DM the CEO before bank transfer.
- **Prescription files:** private bucket, restricted file types, 10 MB maximum, authenticated upload, pharmacist review required. The public storefront does not currently expose a prescription upload form; do not accept real prescription files until the upload workflow and privacy notice are finished and tested.
- **Products:** no real products or prices are seeded. Pharmacy staff must enter verified product information, stock, and prescription requirements. Do not publish products until reviewed.

## Setup overview (Windows laptop)

1. Create a Supabase project at https://supabase.com. Use a strong account password and enable two-factor authentication if available. Do not use a shared staff login.
2. In Supabase, open **SQL Editor**, create a query, paste all of `supabase/schema.sql`, and run it.
3. Open **Project Settings → API** (or the project's API keys page). Copy the Project URL and the publishable/anon key. Paste them into `js/supabase-config.js` replacing the two `PASTE_...` placeholders. **Never paste a `service_role`/secret key into any HTML or JavaScript file.** The public anon key is safe to expose only because RLS is enabled; still verify the policies before deployment.
4. Create the authorized staff account in **Authentication → Users**. Use a unique staff email and a strong password.
5. In SQL Editor, assign the admin claim to that specific staff user, replacing the email with the exact staff email:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'REPLACE-WITH-AUTHORIZED-STAFF-EMAIL';
   ```

   Run only for an authorized pharmacy administrator. Sign out and back in after changing the claim. Never let a customer account receive the `admin` role.
6. Deploy the two Edge Functions using the official Supabase CLI instructions: https://supabase.com/docs/guides/functions. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as server-side function secrets in the Supabase project. The service-role key must never appear in `js/supabase-config.js`, HTML, or any public repository.
7. Before deploying the public website, change the CORS `Access-Control-Allow-Origin` in `supabase/functions/_shared/cors.ts` from `*` to the final website origin. During local testing, use a local development origin only if needed.
8. Open `admin.html` through a local web server or the eventual HTTPS site (not by double-clicking a `file://` path), sign in, add one internal test product, verify public visibility only when both **Approved** and **Published** are true, and test order status updates.
9. Test all access boundaries using a non-admin account: it must not read orders, see other customers' prescription files, change product records, or see unpublished products. Test uploads using harmless dummy files only. Do not use real prescriptions in tests.

## Critical release checks

- Confirm final payment method with the CEO. This package does not take payments or verify transfers.
- Agree branch pickup choices, delivery coverage, delivery fee rules, hours, and who confirms an order.
- Have the responsible licensed pharmacist approve product details and prescription handling rules before publishing medicines.
- Add a clear privacy notice, contact point for privacy requests, data retention/deletion policy, and access process for prescription records before accepting real patient data. Get appropriate Nigerian legal/privacy and pharmacy compliance review.
- Implement and test rate limiting/abuse prevention for guest order submissions before public launch.
- Add customer order confirmation messaging and ensure order totals and stock are reconciled under concurrent submissions. The initial function checks current stock but does not reserve/decrement it atomically; staff must confirm stock before confirming the order.
- The prescription upload function stores private files and request metadata, but the admin dashboard does not yet provide a signed-link viewer. Build and test that restricted review workflow before use.
- The storefront's current product cards/cart are still enquiry-only. The server-side `create-order` function is ready to be wired into a customer checkout UI in the next integration step; do not advertise checkout as live yet.

## Local preview

For a quick static preview, opening `index.html` works. For Supabase auth and admin functionality, use a local web server or HTTPS hosting. On Windows with Python installed, open Command Prompt in this folder and run:

```bat
py -m http.server 8000
```

Then visit `http://localhost:8000/index.html` and `http://localhost:8000/admin.html` in the browser.
