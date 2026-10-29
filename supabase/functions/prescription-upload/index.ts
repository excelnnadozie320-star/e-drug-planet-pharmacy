import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in before uploading a prescription.' }, 401);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Your session has expired. Sign in again.' }, 401);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'Choose a prescription image or PDF.' }, 400);
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return json({ error: 'Use a JPG, PNG, WEBP or PDF file up to 10 MB.' }, 400);
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await db.storage.from('prescriptions').upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: request, error: rowError } = await db.from('prescription_requests').insert({ customer_user_id: user.id, private_object_path: path, status: 'awaiting_pharmacist_review' }).select('id,status,created_at').single();
    if (rowError) {
      await db.storage.from('prescriptions').remove([path]);
      throw rowError;
    }
    return json({ success: true, request_id: request.id, status: request.status, message: 'Prescription submitted securely for pharmacist review. Do not send prescription images in a public review or blog comment.' }, 201);
  } catch (e) {
    console.error('prescription-upload failed', e);
    return json({ error: 'The prescription could not be uploaded. Please try again or contact the pharmacy.' }, 500);
  }
});
