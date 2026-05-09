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

  const { data: services } = await supabase
    .from('services')
    .select('title, service_date, service_time, department')
    .eq('church_id', church.id)
    .eq('is_active', true)
    .order('service_date', { ascending:false })
    .limit(5);

  res.status(200).json({
    church:{
      name: church.name,
      slug: church.slug,
      logo_url: church.logo_url,
      theme_color: church.theme_color || '#2563eb'
    },

    services: services || [],

    cards:[
      {
        title:'오늘의 안내',
        body:'예배와 모임 안내는 교회 공지 채널을 확인해주세요.'
      },
      {
        title:'새가족 안내',
        body:'처음 방문하셨다면 안내위원 또는 담당 리더에게 말씀해주세요.'
      },
      {
        title:'기도와 돌봄',
        body:'기도 요청이나 돌봄이 필요하시면 교회 리더에게 문의해주세요.'
      }
    ]
  });
}
