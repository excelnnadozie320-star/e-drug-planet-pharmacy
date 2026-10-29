# E-Drug Planet Pharmacy — Premium upgrade (frontend)

Built on top of `E-Drug-Planet-Full-Website-Restored.zip`. Only `index.html` was edited among your existing files; `admin.html`, `js/supabase-config.js`, `supabase/schema.sql`, `supabase/config.toml`, both Edge Functions, `css/edp-motion.css` and `js/edp-motion.js` are **unchanged**. An untouched copy of the original was kept as a backup before editing.

## Preview locally
```bat
py -m http.server 8000
```
Open `http://localhost:8000/index.html` (and `/admin.html`). Use a server, not double-click, so the catalogue loader and admin login can make requests.

## What was added
**New files:** `css/edp-premium.css`, `js/edp-premium.js`, `assets/*.webp` (responsive copies of your photos), `assets/og-image.jpg` (1200×630 social image made from your real interior photo + brand text), `supabase/proposed-fixes.sql` (review only).
**Hero:** the flat emblem became a 3-slide carousel: two real interior photos (Ken Burns drift, crossfade) and your original emblem scene. A CSS-3D-inspired capsule floats over it and turns with the mouse. Autoplay pauses on hover/focus/off-screen, has a Pause button and dots (44px targets), supports swipe on phones, and is off under reduced-motion. Nothing waits for it: headline, buttons and info cards are in the HTML.
**Storefront:** enquiry list now has remove (×) per item, Clear list, saved for the tab session, toast with "View list", inline messages instead of `alert()`, search result count and a "No matching items" state, and a **Details** dialog per card (focus-trapped, Esc closes). Still an enquiry list only: no payment, no order claims.
**Live products (optional, read-only):** once `js/supabase-config.js` has real values, the page loads published + pharmacist-approved products from Supabase with a skeleton loader and falls back to your category cards if empty/offline. Prescription products show "Prescription required" and cannot be added to the list. Prices appear only if set in the database; no stock numbers are shown.
**Fixes:** header overflowed between ~680–1080px in the original (7 links + button), now uses the menu below 1080px; careers section moved inside `<main>`; careers headings now use your wording ("Want to be an apprentice?", "Nurse around any of the branches area looking for a job?"); an internal "Photo note" that was visible to the public was converted to an HTML comment; skip link added; branch cards now have "Get directions" + "WhatsApp this branch" and a map-accuracy note; footer shows both addresses and the confirmed WhatsApp number; hero eyebrow now says "Since 2016 · Serving Rivers State".
**SEO:** new title/description (Rivers State), Open Graph + Twitter image, `og:site_name/locale`, `areaServed` and `foundingDate` in the existing JSON-LD (no ratings, hours or certifications added).

## Existing features preserved
Theme toggle and saved preference · all WhatsApp links and numbers · both branch addresses and Maps links · About text, mission · categories · Health tips · Ebola public-health section · reviews placeholders (still clearly "not a testimonial") · careers (WhatsApp enquiry) · floating WhatsApp · footer · search/filter · motion layer · admin dashboard, Supabase schema, Edge Functions.

## Optional Spline scene
Not enabled (no scene was supplied). To use one: publish a scene in Spline, copy its public `.splinecode` URL and set it on the hero:
`<div class="hero-art" id="heroStage" data-spline-url="https://prod.spline.design/XXXX/scene.splinecode" ...>`
It loads Spline's viewer script only on full-motion screens ≥900px wide and replaces the CSS capsule. To pin the viewer version, add `data-spline-script="https://unpkg.com/@splinetool/viewer@<version>/build/spline-viewer.js"`. **This path is untested here** (needs your scene and internet).

## Connect to the existing Supabase project
1. Follow `README-BACKEND-SETUP.md` steps 1–5 (schema, keys, staff account, admin claim).
2. Put the Project URL and **publishable/anon** key in `js/supabase-config.js` (never a `service_role` key). `index.html` already loads that file.
3. Add one internal test product in `admin.html` with Approved + Published on. It should appear on the shop section; refresh to confirm.
4. Review and run `supabase/proposed-fixes.sql` if you agree with it (see below). Deploy Edge Functions and set CORS to your real domain as the backend README says.
Checkout is still **not wired**: `create-order` exists but has no customer form yet, and prescription upload has no UI. Don't advertise either.

## Backend review findings (not changed, no live access)
1. **Customers can self-approve prescription requests.** The insert policy on `prescription_requests` checks only `customer_user_id`, so a signed-in customer could insert a row with `status='approved'`. Fix proposed in `supabase/proposed-fixes.sql`.
2. Public product policy exposes `stock_quantity` to anyone with the public key. Optional view provided.
3. `admin.html` loads `supabase-js@2` unpinned from a CDN with no integrity hash: pin an exact version (+SRI) before launch.
4. Already noted by your backend README and still true: CORS `*`, no rate limiting on guest orders, stock not reserved atomically, no signed-link prescription viewer, privacy notice needed.

## Things you must check or fix
- **The storefront image (`pharmacy-front.png`) appears to be AI-generated** (it has a Gemini sparkle mark in the corner, and it is really a JPEG with a .png name). It is not used as a "real photo": it is captioned "Storefront illustration" and kept out of the hero. Replace it with a real photograph when you have one. The two interior photos look like genuine photos; I did not label them by branch because the project notes say that is unconfirmed.
- **Ebola section:** the Abuja imported-case claim matches current reports I found (WHO/ECDC/news, 20–22 Oct 2026). I could **not** verify the sentence about a Rivers State suspected case testing negative in NCDC's 24 Oct report. Have someone check it against the NCDC source and keep the section updated or remove it.
- Social sharing needs an absolute image URL: after deployment change `og:image`/`twitter:image` to `https://your-domain/assets/og-image.jpg` and add `og:url` + canonical.
- Opening hours, reviews, certifications, product prices/stock: none added. `Pharmacy` JSON-LD still has no hours.
- Map buttons open an address search, not a verified pin.

## What I tested (headless Chromium via Playwright, local server)
Passed: no console errors or failed requests; no horizontal overflow at 390/680/700/820/1024/1080/1100/1280/1536px; no broken images; JSON-LD parses; 14 WhatsApp links intact and the list message URL is correct; add/remove/clear/persist cart; search + empty state; details dialog + Esc; theme toggle and dark mode screenshots; hamburger menu + Esc + `aria-expanded`; slideshow autoplay, pause on hover, swipe; reduced-motion (no autoplay, all content visible, no animation); live-product rendering and failure fallback **using mocked Supabase responses**.
**Not tested:** the real Supabase backend (no credentials), admin login, Edge Functions, a real Android/iOS device, Safari/Firefox, Spline, screen readers, real WhatsApp opening (no network here).
