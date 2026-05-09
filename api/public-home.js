import {
  adminClient,
  safeText
} from './_supabase.js';

export default async function handler(req, res) {
  const churchCode = safeText(req.query.church);

  if (!churchCode) {
    return res.status(400).json({
      error:'교회코드가 필요합니다.'
    });
  }

  const supabase = adminClient();

  const { data: church, error } = await supabase
    .from('churches')
    .select('*')
    .eq('slug', churchCode)
    .single();

  if (error || !church) {
    return res.status(404).json({
      error:'교회를 찾을 수 없습니다.'
    });
  }

  const { data: home } = await supabase
    .from('church_home')
    .select('*')
    .eq('church_id', church.id)
    .single();

  const { data: services } = await supabase
    .from('services')
    .select(`
      id,
      title,
      service_date,
      service_time,
      department,
      token,
      check_start_at,
      check_end_at,
      token_expires_at,
      is_active
    `)
    .eq('church_id', church.id)
    .eq('is_active', true)
    .order('service_date', { ascending:false })
    .limit(5);

  res.status(200).json({
    church:{
      id: church.id,
      name: church.name,
      slug: church.slug,
      logo_url: church.logo_url,
      theme_color: church.theme_color || '#2563eb'
    },

    home: home || {},

    services: services || []
  });
}
