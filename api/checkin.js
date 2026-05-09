import {
  adminClient,
  safeText,
  parseBody
} from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error:'POST만 가능합니다.'
    });
  }

  const supabase = adminClient();
  const body = parseBody(req);

  const token = safeText(body.token);
  const name = safeText(body.name);
  const phone_last4 = safeText(body.phone_last4);
  const department = safeText(body.department) || '새가족';

  if (!token || !name || !/^\d{4}$/.test(phone_last4)) {
    return res.status(400).json({
      error:'이름과 휴대폰 뒤 4자리를 입력해주세요.'
    });
  }

  const { data: service } = await supabase
    .from('services')
    .select('*, churches(id, name, slug, status, theme_color, logo_url)')
    .eq('token', token)
    .eq('is_active', true)
    .single();

  if (!service) {
    return res.status(404).json({
      error:'유효하지 않은 QR입니다.'
    });
  }

  if (service.churches?.status === 'paused') {
    return res.status(403).json({
      error:'현재 교회 계정이 일시중지 상태입니다.'
    });
  }

  const now = new Date();

  if (service.check_start_at && now < new Date(service.check_start_at)) {
    return res.status(403).json({
      error:'아직 출석체크 시간이 아닙니다.'
    });
  }

  if (service.check_end_at && now > new Date(service.check_end_at)) {
    return res.status(403).json({
      error:'출석체크 시간이 종료되었습니다.'
    });
  }

  let member = null;
  let isNewMember = false;

  let query = supabase
    .from('members')
    .select('*')
    .eq('church_id', service.church_id)
    .eq('name', name)
    .eq('phone_last4', phone_last4)
    .eq('status', 'active');

  const { data: matches, error: matchError } = await query;

  if (matchError) {
    return res.status(500).json({
      error:'교인 조회 실패'
    });
  }

  if (matches && matches.length > 1) {
    return res.status(409).json({
      error:'동명이인이 있습니다. 부서를 입력해주세요.'
    });
  }

  if (matches && matches.length === 1) {
    member = matches[0];
  }

  if (!member) {
    const { data: created, error: createError } = await supabase
      .from('members')
      .insert({
        church_id: service.church_id,
        name,
        phone_last4,
        department,
        group_name: '',
        member_type: 'new',
        status: 'active',
        first_visit_date: new Date().toISOString().slice(0,10),
        memo: 'QR 출석 중 자동 등록된 새가족'
      })
      .select()
      .single();

    if (createError) {
      return res.status(500).json({
        error:'새가족 등록 실패'
      });
    }

    member = created;
    isNewMember = true;
  }

  const { data: saved, error } = await supabase
    .from('attendance')
    .upsert({
      church_id: service.church_id,
      member_id: member.id,
      service_id: service.id,
      status: 'present',
      check_method: isNewMember ? 'qr_new_member' : 'qr',
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
      action: isNewMember ? 'new_member_qr_checkin' : 'qr_checkin',
      after_data: saved,
      detail: `${member.name} QR 출석`
    });

  res.status(200).json({
    ok:true,
    is_new_member: isNewMember,

    church:{
      id: service.churches.id,
      name: service.churches.name,
      slug: service.churches.slug,
      theme_color: service.churches.theme_color,
      logo_url: service.churches.logo_url
    },

    service:{
      title: service.title,
      service_date: service.service_date,
      service_time: service.service_time
    },

    member:{
      name: member.name,
      department: member.department,
      member_type: member.member_type
    },

    checked_at: saved.checked_at
  });
}
