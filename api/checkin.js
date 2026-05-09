import {
  adminClient,
  safeText
} from './_supabase.js';

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error:'POST만 가능합니다.'
    });
  }

  const supabase = adminClient();

  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

  const token =
    safeText(body.token);

  const name =
    safeText(body.name);

  const phone_last4 =
    safeText(body.phone_last4);

  const department =
    safeText(body.department);

  if (
    !token ||
    !name ||
    !/^\d{4}$/.test(phone_last4)
  ) {
    return res.status(400).json({
      error:'이름과 휴대폰 뒤 4자리를 입력해주세요.'
    });
  }

  const { data: service } =
    await supabase
      .from('services')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

  if (!service) {
    return res.status(404).json({
      error:'유효하지 않은 QR입니다.'
    });
  }

  const now = new Date();

  if (
    service.check_start_at &&
    now < new Date(service.check_start_at)
  ) {
    return res.status(403).json({
      error:'아직 출석체크 시간이 아닙니다.'
    });
  }

  if (
    service.check_end_at &&
    now > new Date(service.check_end_at)
  ) {
    return res.status(403).json({
      error:'출석체크 시간이 종료되었습니다.'
    });
  }

  let query = supabase
    .from('members')
    .select('*')
    .eq('church_id', service.church_id)
    .eq('name', name)
    .eq('phone_last4', phone_last4)
    .eq('status', 'active');

  if (department) {
    query = query.eq('department', department);
  }

  const {
    data: matches,
    error: matchError
  } = await query;

  if (matchError) {
    return res.status(500).json({
      error:'교인 조회 실패'
    });
  }

  if (!matches || matches.length === 0) {
    return res.status(404).json({
      error:'등록된 정보를 찾지 못했습니다.'
    });
  }

  if (matches.length > 1) {
    return res.status(409).json({
      error:'동명이인이 있습니다. 부서를 입력해주세요.'
    });
  }

  const member = matches[0];

  const { data: saved, error } =
    await supabase
      .from('attendance')
      .upsert({
        church_id: service.church_id,
        member_id: member.id,
        service_id: service.id,
        status: 'present',
        check_method: 'qr',
        checked_at: new Date().toISOString()
      }, {
        onConflict:'member_id,service_id'
      })
      .select()
      .single();

  if (error) {
    return res.status(500).json({
      error:'출석 저장 실패'
    });
  }

  await supabase
    .from('attendance_logs')
    .insert({
      church_id: service.church_id,
      member_id: member.id,
      service_id: service.id,
      action: 'qr_checkin',
      after_data: saved,
      detail: `${member.name} QR 출석`
    });

  res.status(200).json({
    ok:true,
    service:{
      title: service.title,
      service_date: service.service_date,
      service_time: service.service_time
    },
    member:{
      name: member.name,
      department: member.department
    },
    checked_at: saved.checked_at
  });
}
