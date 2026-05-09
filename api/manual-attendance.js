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
    'pastor',
    'leader'
  ]);

  if (!auth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error:'POST만 가능합니다.'
    });
  }

  const body = parseBody(req);
  const supabase = adminClient();
  const churchId = auth.profile.church_id;

  const memberId = safeText(body.member_id);
  const serviceId = safeText(body.service_id);
  const status = safeText(body.status) || 'present';

  if (!memberId || !serviceId) {
    return res.status(400).json({
      error:'교인과 예배를 선택해주세요.'
    });
  }

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('church_id', churchId)
    .eq('id', memberId)
    .single();

  if (!member) {
    return res.status(404).json({
      error:'교인을 찾을 수 없습니다.'
    });
  }

  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('church_id', churchId)
    .eq('id', serviceId)
    .single();

  if (!service) {
    return res.status(404).json({
      error:'예배를 찾을 수 없습니다.'
    });
  }

  const { data, error } = await supabase
    .from('attendance')
    .upsert({
      church_id: churchId,
      member_id: memberId,
      service_id: serviceId,
      status,
      check_method: 'manual',
      checked_by: auth.user.id,
      checked_at: new Date().toISOString()
    }, {
      onConflict:'member_id,service_id'
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error:error.message
    });
  }

  await supabase
    .from('attendance_logs')
    .insert({
      church_id: churchId,
      member_id: memberId,
      service_id: serviceId,
      action: 'manual_checkin',
      after_data: data,
      actor_id: auth.user.id,
      detail: `${member.name} 수동 출석 처리`
    });

  res.status(200).json({
    ok:true,
    attendance:data
  });
}
