import {
  adminClient,
  requireSuperAdmin,
  parseBody,
  safeText
} from './_supabase.js';

export default async function handler(req, res) {

  const auth =
    await requireSuperAdmin(req, res);

  if (!auth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error:'POST만 가능합니다.'
    });
  }

  const body =
    parseBody(req);

  const churchId =
    safeText(body.church_id);

  const status =
    safeText(body.status);

  if (
    !churchId ||
    !['active','paused'].includes(status)
  ) {
    return res.status(400).json({
      error:'교회 ID와 상태가 필요합니다.'
    });
  }

  const { data, error } =
    await adminClient()
      .from('churches')
      .update({
        status,
        updated_at:
          new Date().toISOString()
      })
      .eq('id', churchId)
      .select()
      .single();

  if (error) {
    return res.status(500).json({
      error:error.message
    });
  }

  res.status(200).json({
    ok:true,
    church:data
  });
}
