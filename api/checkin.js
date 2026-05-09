import {
  adminClient,
  safeText,
  parseBody
} from './_supabase.js';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return Math.round(
    R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

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

  const userLat = toNumber(body.latitude);
  const userLng = toNumber(body.longitude);

  if (!token || !name || !/^\d{4}$/.test(phone_last4)) {
    return res.status(400).json({
      error:'이름과 휴대폰 뒤 4자리를 입력해주세요.'
    });
  }

  const {
    data: service,
    error: serviceError
  } = await supabase
    .from('services')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .single();

  if (serviceError || !service) {
    return res.status(404).json({
      error:'유효하지 않은 QR입니다.'
    });
  }

  const {
    data: church,
    error: churchError
  } = await supabase
    .from('churches')
    .select('id, name, slug, status, theme_color, logo_url, latitude, longitude, checkin_radius_m')
    .eq('id', service.church_id)
    .single();

  if (churchError || !church) {
    return res.status(404).json({
      error:'교회 정보를 찾지 못했습니다.'
    });
  }

  if (church.status === 'paused') {
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

  const churchLat = toNumber(church.latitude);
  const churchLng = toNumber(church.longitude);
  const radius = Number(church.checkin_radius_m || 150);

  let distance = null;

  if (churchLat !== null && churchLng !== null) {
    if (userLat === null || userLng === null) {
      return res.status(403).json({
        error:'현장 출석 확인을 위해 위치 권한이 필요합니다.'
      });
    }

    distance = distanceMeters(
      churchLat,
      churchLng,
      userLat,
      userLng
    );

    if (distance > radius) {
      return res.status(403).json({
        error:`교회 현장에서만 출석체크할 수 있습니다. 현재 약 ${distance}m 떨어져 있습니다.`
      });
    }
  }

  let member = null;
  let isNewMember = false;

  const {
    data: matches,
    error: matchError
  } = await supabase
    .from('members')
    .select('*')
    .eq('church_id', service.church_id)
    .eq('name', name)
    .eq('phone_last4', phone_last4)
    .eq('status', 'active');

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
    const {
      data: created,
      error: createError
    } = await supabase
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

  const {
    data: saved,
    error
  } = await supabase
    .from('attendance')
    .upsert({
      church_id: service.church_id,
      member_id: member.id,
      service_id: service.id,
      status: 'present',
      check_method: isNewMember ? 'qr_new_member' : 'qr',
      checked_at: new Date().toISOString(),
      checkin_latitude: userLat,
      checkin_longitude: userLng,
      checkin_distance_m: distance
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
    distance_m: distance,

    church:{
      id: church.id,
      name: church.name,
      slug: church.slug,
      theme_color: church.theme_color,
      logo_url: church.logo_url
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
