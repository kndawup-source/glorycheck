import {
  adminClient,
  requireSuperAdmin,
  parseBody,
  safeText,
  slugify
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

  const supabase =
    adminClient();

  const churchName =
    safeText(body.church_name);

  const slug =
    slugify(body.slug || churchName);

  const plan =
    safeText(body.plan) || 'standard';

  const memo =
    safeText(body.memo);

  const adminEmail =
    safeText(body.admin_email);

  const adminPassword =
    safeText(body.admin_password);

  const adminName =
    safeText(body.admin_name) || '관리자';

  if (
    !churchName ||
    !slug ||
    !adminEmail ||
    !adminPassword
  ) {
    return res.status(400).json({
      error:'교회명, slug, 관리자 이메일, 비밀번호가 필요합니다.'
    });
  }

  const { data: church, error: churchError } =
    await supabase
      .from('churches')
      .insert({
        name: churchName,
        slug,
        plan,
        memo,
        status: 'active'
      })
      .select()
      .single();

  if (churchError) {
    return res.status(500).json({
      error: churchError.message
    });
  }

  const {
    data: userData,
    error: userError
  } =
    await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    });

  if (userError) {

    await supabase
      .from('churches')
      .delete()
      .eq('id', church.id);

    return res.status(500).json({
      error: userError.message
    });
  }

  const userId =
    userData.user.id;

  const { error: profileError } =
    await supabase
      .from('profiles')
      .insert({
        id: userId,
        church_id: church.id,
        name: adminName,
        role: 'owner',
        system_role: 'church_user'
      });

  if (profileError) {
    return res.status(500).json({
      error: profileError.message
    });
  }

  await Promise.all([

    supabase
      .from('departments')
      .insert([
        {
          church_id: church.id,
          name: '청년부'
        },
        {
          church_id: church.id,
          name: '장년부'
        }
      ]),

    supabase
      .from('service_templates')
      .insert([
        {
          church_id: church.id,
          title: '주일예배',
          weekday: 0,
          service_time: '11:00',
          department: '전체',
          is_active: true
        }
      ])
  ]);

  res.status(200).json({
    ok: true,

    church,

    admin: {
      id: userId,
      email: adminEmail,
      name: adminName
    }
  });
}
