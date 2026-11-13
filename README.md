# NEXUS DROP AI PRO — Zero-subscription starter

A static storefront hosted on GitHub Pages, with Supabase Free used for database, authentication and server-side Edge Functions. Supplier operations use CSV files. No paid API, AI subscription, Shopify subscription, Shiprocket subscription or paid automation tool is required by this starter.

## What is included
- Mobile-friendly storefront and order request form
- Supabase product database and admin sign-in
- Stock CSV import with SKU upsert and suggested selling price
- Supplier order CSV export for COD / payment-verified orders
- Tracking CSV import
- Server-side order validation and admin-only import functions
- GitHub Pages deployment workflow
- CSV templates

## Important limits / honest status
- This is deployable starter software, not a live DeoDap integration. DeoDap's real stock/order/tracking CSV formats must be obtained and mapped.
- A CSV export does not submit an order to DeoDap. Admin must upload/enter it using the supplier's approved workflow and confirm supplier acceptance.
- No payment gateway is connected. Prepaid orders remain in `pending` until the admin separately verifies payment. COD export is only appropriate if DeoDap confirms COD fulfilment for the account and product.
- The starter does not promise automatic AI product discovery. Product selection and supplier price/stock validation are based on imported data and rules.
- Free tiers have quotas, may change, and are not guaranteed forever. Custom domains, payment processing, SMS, email delivery and high-volume hosting can incur charges.
- Do not expose the Supabase `service_role` key in browser files or GitHub.

## Deploy

### A. Create Supabase project
1. Create a project at https://supabase.com/ (choose Free plan).
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Project Settings > API, copy Project URL and anon/publishable key.
4. Create an admin user in Authentication > Users. Disable public signups after creating your admin user if the dashboard offers that setting.
5. Deploy Edge Functions using Supabase CLI from this folder:
   - Install Supabase CLI locally.
   - `supabase login`
   - `supabase link --project-ref YOUR_PROJECT_REF`
   - `supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co SUPABASE_ANON_KEY=YOUR_ANON_KEY SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY`
   - `supabase functions deploy create-order`
   - `supabase functions deploy admin-stock-import`
   - `supabase functions deploy admin-tracking-import`
6. Ensure the functions are deployed with JWT verification enabled for the two admin functions. `create-order` is public but validates fields and product availability.

### B. Configure frontend
1. Copy `config.example.js` to `config.js`.
2. Add your Supabase Project URL and anon/publishable key.
3. Commit `config.js` to your private repository if possible. The anon key is designed for public clients; RLS and Edge Function checks protect data. Never place service-role credentials here.
4. Ensure `index.html` loads `config.js` before `app.js` by adding `<script src="config.js"></script>` immediately before `<script src="app.js"></script>`.

### C. Deploy GitHub Pages
1. Create a GitHub repository and upload all project files.
2. Use branch `main`.
3. In Settings > Pages, choose GitHub Actions as the build/deploy source.
4. Push to `main`; the included workflow deploys the site.
5. Open the Pages URL and test admin login, stock import and a test order.

## CSV formats
### Stock import
Required headers: `sku,name,supplier_cost,stock_qty`. Optional: `description,category,image_url,weight_kg,is_active,selling_price,shipping_estimate,fee_estimate,return_reserve`.
- `is_active` should be `false` until supplier terms, sample quality and real stock are verified.
- If `selling_price` is blank, the import function estimates a price using cost + estimates + 30% markup, rounded up to nearest ₹10. This is a pricing suggestion, not a profit guarantee.
- Re-import updates existing SKU records.

### Supplier order export
The admin dashboard exports: `nexus_order_id,sku,product_name,quantity,customer_name,phone,address,pincode,payment_method`.
Map these headers to DeoDap's actual required template only after receiving it from DeoDap.

### Tracking import
Required: `nexus_order_id`. Optional: `tracking_number,courier,fulfilment_status`.

## Operating workflow
1. Get written confirmation from DeoDap about reseller account, dropship fulfilment, white-labeling, COD, return/RTO costs, CSV formats and permission to use the CSV workflow.
2. Import catalogue/stock CSV with all products inactive.
3. Verify sample product, total landed cost, delivery area, return terms and actual stock.
4. Set verified products active in Supabase (admin SQL or a future admin UI).
5. Customer order arrives as `awaiting_review`.
6. Verify payment for prepaid orders; verify COD is accepted by DeoDap for COD orders.
7. Export eligible orders and submit using supplier's approved portal/process.
8. Import supplier confirmation/tracking CSV.
9. Reconcile delivered orders, supplier charges, shipping, fees, RTO and refunds before calculating net profit.

## Security / production checklist
- Use a strong unique admin password and enable MFA if available.
- Restrict admin account creation; never share admin credentials.
- Add rate limiting / CAPTCHA / abuse protection before public launch.
- Add order status and payment verification admin controls before accepting real prepaid orders.
- Add privacy policy, terms, shipping/returns/refund policy and contact details.
- Confirm applicable Indian tax, consumer protection and business requirements.
- Back up supplier CSVs and database regularly.
