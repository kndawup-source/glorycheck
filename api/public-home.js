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

    home: home || {},

    services: services || [],

    cards:[
      {
        title: home?.notice_title || '오늘의 안내',
        body: home?.notice_body || '예배와 모임 안내는 교회 공지 채널을 확인해주세요.'
      },
      {
        title: home?.sermon_title || '이번 주 말씀',
        body: home?.sermon_link || '설교 영상 또는 말씀 링크가 준비 중입니다.'
      },
      {
        title:'새가족 안내',
        body: home?.new_family_text || '처음 방문하셨다면 안내위원 또는 담당 리더에게 말씀해주세요.'
      },
      {
        title:'헌금 안내',
        body: home?.offering_text || '온라인 헌금 안내는 교회 공식 안내를 확인해주세요.'
      }
    ]
  });
}
