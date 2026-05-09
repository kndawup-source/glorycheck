import {
  adminClient,
  requireAuth,
  parseBody,
  safeText
} from './_supabase.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, [
    'owner',
    'admin',
    'pastor'
  ]);

  if (!auth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error:'POST만 가능합니다.'
    });
  }

  const body = parseBody(req);
  const churchId = auth.profile.church_id;

  const payload = {
    church_id: churchId,
    notice_title: safeText(body.notice_title),
    notice_body: safeText(body.notice_body),
    sermon_title: safeText(body.sermon_title),
    sermon_link: safeText(body.sermon_link),
    bulletin_link: safeText(body.bulletin_link),
    new_family_text: safeText(body.new_family_text),
    offering_text: safeText(body.offering_text),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await adminClient()
    .from('church_home')
    .upsert(payload, {
      onConflict:'church_id'
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error:error.message
    });
  }

  res.status(200).json({
    ok:true,
    home:data
  });
}
