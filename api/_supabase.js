import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function publicClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

export async function getUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');

  if (!token) return null;

  const { data, error } = await publicClient().auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}

export async function getProfile(userId) {
  const { data } = await adminClient()
    .from('profiles')
    .select('*, churches(*)')
    .eq('id', userId)
    .single();

  return data;
}

export async function requireAuth(req, res, roles = []) {
  const user = await getUser(req);

  if (!user) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }

  const profile = await getProfile(user.id);

  if (!profile) {
    res.status(403).json({ error: '관리자 프로필이 없습니다.' });
    return null;
  }

  if (roles.length && !roles.includes(profile.role)) {
    res.status(403).json({ error: '권한이 없습니다.' });
    return null;
  }

  return { user, profile };
}

export function safeText(v) {
  return String(v ?? '').trim();
}
export async function requireSuperAdmin(req, res){

  const user =
    await getUser(req);

  if (!user) {

    res.status(401).json({
      error:'로그인이 필요합니다.'
    });

    return null;
  }

  const profile =
    await getProfile(user.id);

  if (
    !profile ||
    profile.system_role !== 'super_admin'
  ) {

    res.status(403).json({
      error:'슈퍼관리자 권한이 필요합니다.'
    });

    return null;
  }

  return {
    user,
    profile
  };
}

export function parseBody(req){

  return typeof req.body === 'string'
    ? JSON.parse(req.body)
    : (req.body || {});
}

export function slugify(input){

  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
