import {
  adminClient,
  requireAuth,
  parseBody
} from './_supabase.js';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, [
    'owner',
    'admin'
  ]);

  if (!auth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error:'POST만 가능합니다.'
    });
  }

  const body = parseBody(req);

  const latitude = toNumber(body.latitude);
  const longitude = toNumber(body.longitude);
  const radius = Number(body.checkin_radius_m || 150);

  if (latitude === null || longitude === null) {
    return res.status(400).json({
      error:'위도와 경도가 필요합니다.'
    });
  }

  if (radius < 30 || radius > 1000) {
    return res.status(400).json({
      error:'출석 허용 반경은 30m 이상 1000m 이하로 설정해주세요.'
    });
  }

  const { data, error } = await adminClient()
    .from('churches')
    .update({
      latitude,
      longitude,
      checkin_radius_m: radius,
      updated_at: new Date().toISOString()
    })
    .eq('id', auth.profile.church_id)
    .select('id, name, slug, latitude, longitude, checkin_radius_m')
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
