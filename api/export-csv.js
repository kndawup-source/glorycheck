import {
  adminClient,
  requireAuth
} from './_supabase.js';

function esc(v){

  const text =
    String(v ?? '');

  return `"${text.replace(/"/g,'""')}"`;
}

export default async function handler(req, res) {

  const auth = await requireAuth(req, res, [
    'owner',
    'admin',
    'pastor',
    'leader',
    'viewer'
  ]);

  if (!auth) return;

  const churchId =
    auth.profile.church_id;

  const serviceId =
    req.query.service_id;

  let q = adminClient()
    .from('attendance')
    .select(`
      checked_at,
      status,
      check_method,
      memo,
      members(
        name,
        phone_last4,
        department,
        group_name,
        member_type
      ),
      services(
        id,
        title,
        service_date,
        service_time,
        department
      )
    `)
    .eq('church_id', churchId)
    .order('checked_at', {
      ascending:false
    });

  if (serviceId) {
    q = q.eq(
      'service_id',
      serviceId
    );
  }

  const { data, error } =
    await q;

  if (error) {
    return res
      .status(500)
      .send('CSV 생성 실패');
  }

  const header = [
    '날짜',
    '예배명',
    '예배시간',
    '이름',
    '휴대폰뒤4자리',
    '부서',
    '셀/구역',
    '교인구분',
    '상태',
    '체크시간',
    '체크방식',
    '메모'
  ];

  const body =
    (data || []).map(r => [

      r.services?.service_date,
      r.services?.title,
      r.services?.service_time,

      r.members?.name,
      r.members?.phone_last4,
      r.members?.department,
      r.members?.group_name,
      r.members?.member_type,

      r.status,
      r.checked_at,
      r.check_method,
      r.memo
    ]);

  const csv = [
    header.map(esc).join(','),

    ...body.map(
      row => row.map(esc).join(',')
    )
  ].join('\n');

  res.setHeader(
    'Content-Type',
    'text/csv; charset=utf-8'
  );

  res.setHeader(
    'Content-Disposition',
    'attachment; filename="church-attendance.csv"'
  );

  res
    .status(200)
    .send('\uFEFF' + csv);
}
