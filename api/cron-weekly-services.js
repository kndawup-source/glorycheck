import crypto from 'crypto';

import {
  adminClient
} from './_supabase.js';

function nextDateForWeekday(weekday){

  const d = new Date();

  const diff =
    (weekday + 7 - d.getDay()) % 7 || 7;

  d.setDate(
    d.getDate() + diff
  );

  return d
    .toISOString()
    .slice(0,10);
}

export default async function handler(req, res) {

  const secret =
    req.headers['authorization']
      ?.replace('Bearer ', '');

  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET
  ) {
    return res.status(401).json({
      error:'Unauthorized'
    });
  }

  const supabase =
    adminClient();

  const {
    data: templates,
    error
  } = await supabase
    .from('service_templates')
    .select('*')
    .eq('is_active', true);

  if (error) {
    return res.status(500).json({
      error:error.message
    });
  }

  const created = [];

  for (const t of templates || []) {

    const service_date =
      nextDateForWeekday(t.weekday);

    const token =
      crypto.randomBytes(24)
        .toString('hex');

    const checkStart =
      new Date(
        `${service_date}T${t.service_time || '00:00'}:00+09:00`
      );

    checkStart.setMinutes(
      checkStart.getMinutes() - 30
    );

    const checkEnd =
      new Date(checkStart);

    checkEnd.setHours(
      checkEnd.getHours() + 3
    );

    const { data } =
      await supabase
        .from('services')
        .upsert({
          church_id: t.church_id,
          title: t.title,
          service_date,
          service_time: t.service_time,
          department: t.department || '전체',

          token,

          token_expires_at:
            checkEnd.toISOString(),

          check_start_at:
            checkStart.toISOString(),

          check_end_at:
            checkEnd.toISOString(),

          is_active: true

        }, {
          onConflict:
            'church_id,title,service_date,service_time'
        })
        .select()
        .single();

    if (data) {
      created.push(data);
    }
  }

  res.status(200).json({
    ok:true,
    created: created.length
  });
}
