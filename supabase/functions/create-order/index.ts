import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json();
    const { customer_name, customer_phone, customer_email, fulfillment, delivery_address, customer_note, items } = body;
    if (typeof customer_name !== 'string' || customer_name.trim().length < 2 || customer_name.length > 120) return json({ error: 'Enter a valid customer name.' }, 400);
    if (typeof customer_phone !== 'string' || customer_phone.trim().length < 7 || customer_phone.length > 30) return json({ error: 'Enter a valid phone number.' }, 400);
    if (!['pickup_main', 'pickup_location_road', 'delivery'].includes(fulfillment)) return json({ error: 'Choose delivery or a valid pickup branch.' }, 400);
    if (fulfillment === 'delivery' && (typeof delivery_address !== 'string' || delivery_address.trim().length < 8)) return json({ error: 'Enter a complete delivery address.' }, 400);
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) return json({ error: 'Your cart must contain between 1 and 30 different products.' }, 400);
    const cleanItems = items.map((x: any) => ({ product_id: String(x.product_id || ''), quantity: Number(x.quantity) }));
    if (cleanItems.some((x: any) => !/^[0-9a-f-]{36}$/i.test(x.product_id) || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 50)) return json({ error: 'One or more cart items are invalid.' }, 400);
    if (new Set(cleanItems.map((x: any) => x.product_id)).size !== cleanItems.length) return json({ error: 'Duplicate cart items are not allowed.' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, key, { auth: { persistSession: false } });
    const ids = cleanItems.map((x: any) => x.product_id);
    const { data: products, error: productError } = await db.from('products').select('id,name,price_ngn,stock_quantity,requires_prescription,active,pharmacist_approved').in('id', ids);
    if (productError) throw productError;
    if (!products || products.length !== cleanItems.length) return json({ error: 'A product in your cart is no longer available. Refresh and try again.' }, 409);
    const byId = new Map(products.map((p: any) => [p.id, p]));
    let subtotal = 0;
    const lines = [];
    for (const item of cleanItems) {
      const p: any = byId.get(item.product_id);
      if (!p || !p.active || !p.pharmacist_approved) return json({ error: 'A product in your cart is unavailable. Please contact the pharmacy.' }, 409);
      if (p.requires_prescription) return json({ error: 'Prescription-only medicines cannot be ordered through guest checkout. Please contact the pharmacist for the approved prescription review process.' }, 400);
      if (!Number.isInteger(p.price_ngn) || p.price_ngn < 0) return json({ error: `Price needs to be confirmed for ${p.name}. Please contact the pharmacy.` }, 400);
      if (p.stock_quantity < item.quantity) return json({ error: `${p.name} does not have enough stock for this quantity.` }, 409);
      const lineTotal = p.price_ngn * item.quantity;
      subtotal += lineTotal;
      lines.push({ product_id: p.id, product_name_snapshot: p.name, unit_price_ngn: p.price_ngn, quantity: item.quantity, line_total_ngn: lineTotal });
    }
    if (!Number.isSafeInteger(subtotal) || subtotal > 100_000_000) return json({ error: 'Cart total is outside the allowed range.' }, 400);
    // Delivery charges remain zero until the pharmacy sets and publishes an approved fee.
    const deliveryFee = 0;
    const { data: order, error: orderError } = await db.from('orders').insert({
      customer_name: customer_name.trim(), customer_phone: customer_phone.trim(),
      customer_email: typeof customer_email === 'string' && customer_email.includes('@') ? customer_email.trim().slice(0,254) : null,
      fulfillment, delivery_address: fulfillment === 'delivery' ? delivery_address.trim().slice(0,500) : null,
      customer_note: typeof customer_note === 'string' ? customer_note.trim().slice(0,1000) : '',
      subtotal_ngn: subtotal, delivery_fee_ngn: deliveryFee, total_ngn: subtotal + deliveryFee,
      payment_method: 'contact_ceo', payment_status: 'not_paid', status: 'pending_confirmation'
    }).select('id,order_number,total_ngn').single();
    if (orderError) throw orderError;
    const { error: linesError } = await db.from('order_items').insert(lines.map((line) => ({ ...line, order_id: order.id })));
    if (linesError) {
      await db.from('orders').delete().eq('id', order.id);
      throw linesError;
    }
    return json({ success: true, order_number: order.order_number, total_ngn: order.total_ngn, message: 'Order received for pharmacy confirmation. No payment has been taken.' }, 201);
  } catch (e) {
    console.error('create-order failed', e);
    return json({ error: 'We could not submit the order. Please try again or contact the pharmacy.' }, 500);
  }
});
