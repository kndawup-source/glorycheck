import {
  adminClient,
  requireAuth,
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
      error: 'POST만 가능합니다.'
    });
  }

  const supabase = adminClient();

  const churchId = auth.profile.church_id;

  const body = req.body || {};

  const payload = {
    church_id: churchId,
    name: safeText(body.name),
    phone_last4: safeText(body.phone_last4),
    department: safeText(body.department) || '미지정',
    group_name: safeText(body.group_name),
    member_type: safeText(body.member_type) || 'regular',
    status: safeText(body.status) || 'active',
    first_visit_date: body.first_visit_date || null,
    memo: safeText(body.memo),
    updated_at: new Date().toISOString()
  };

  if (
    !payload.name ||
    !/^\\d{4}$/.test(payload.phone_last4)
  ) {
    return res.status(400).json({
      error:'이름과 휴대폰 뒤 4자리가 필요합니다.'
    });
  }

  let result;
  let before = null;

  if (body.id) {

    const old = await supabase
      .from('members')
      .select('*')
      .eq('church_id', churchId)
      .eq('id', body.id)
      .single();

    before = old.data;

    result = await supabase
      .from('members')
      .update(payload)
      .eq('church_id', churchId)
      .eq('id', body.id)
      .select()
      .single();

  } else {

    result = await supabase
      .from('members')
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) {
    return res.status(500).json({
      error: result.error.message
    });
  }

  await supabase
    .from('attendance_logs')
    .insert({
      church_id: churchId,
      member_id: result.data.id,
      action: body.id
        ? 'member_update'
        : 'member_create',
      before_data: before,
      after_data: result.data,
      actor_id: auth.user.id,
      detail: `${result.data.name} 교인 정보 저장`
    });

  res.status(200).json({
    ok: true,
    member: result.data
  });
}
