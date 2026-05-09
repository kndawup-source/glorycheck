import crypto from 'crypto';

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
      error:'POST만 가능합니다.'
    });
  }

  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

  const churchId = auth.profile.church_id;

  const title =
    safeText(body.title);

  const service_date =
    safeText(body.service_date);

  const service_time =
    safeText(body.service_time);

  const department =
    safeText(body.department) || '전체';

  const expireHours =
    Number(body.expire_hours || 3);

  if (!title || !service_date) {
    return res.status(400).json({
      error:'예배명과 날짜가 필요합니다.'
    });
  }

  const token =
    crypto.randomBytes(24).toString('hex');

  const expires =
    new Date(
      Date.now() +
      expireHours * 60 * 60 * 1000
    ).toISOString();

  const { data, error } =
    await adminClient()
      .from('services')
      .insert({
        church_id: churchId,
        title,
        service_date,
        service_time,
        department,
        token,
        token_expires_at: expires,

        check_start_at:
          new Date(
            Date.now() - 30 * 60 * 1000
          ).toISOString(),

        check_end_at: expires,

        is_active: true,

        created_by: auth.user.id
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
    service:data
  });
}
