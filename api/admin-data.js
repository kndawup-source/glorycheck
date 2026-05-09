import { adminClient, requireAuth } from './_supabase.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, [
    'owner',
    'admin',
    'pastor',
    'leader',
    'viewer'
  ]);

  if (!auth) return;

  const supabase = adminClient();
  const churchId = auth.profile.church_id;
  const role = auth.profile.role;
  const dept = auth.profile.department;

  let memberQuery = supabase
    .from('members')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  if (role === 'leader' && dept) {
    memberQuery = memberQuery.eq('department', dept);
  }

  const [
    membersRes,
    servicesRes,
    attendanceRes,
    templateRes
  ] = await Promise.all([
    memberQuery,

    supabase
      .from('services')
      .select('*')
      .eq('church_id', churchId)
      .order('service_date', { ascending: false })
      .limit(80),

    supabase
      .from('attendance')
      .select(`
        *,
        members(name, phone_last4, department, group_name, member_type),
        services(title, service_date, service_time, department)
      `)
      .eq('church_id', churchId)
      .order('checked_at', { ascending: false })
      .limit(300),

    supabase
      .from('service_templates')
      .select('*')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
  ]);

  const members = membersRes.data || [];
  const services = servicesRes.data || [];
  const attendance = attendanceRes.data || [];
  const templates = templateRes.data || [];

  const activeMembers = members.filter(m => m.status === 'active');

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const attendedMemberIds = new Set(
    attendance
      .filter(a =>
        ['present', 'late'].includes(a.status) &&
        new Date(a.checked_at) >= fourWeeksAgo
      )
      .map(a => a.member_id)
  );

  const longAbsent = activeMembers.filter(m => !attendedMemberIds.has(m.id));

  res.status(200).json({
    profile: auth.profile,
    counts: {
      members: members.length,
      active_members: activeMembers.length,
      services: services.length,
      attendance: attendance.length,
      long_absent: longAbsent.length
    },
    members,
    services,
    attendance,
    templates,
    long_absent: longAbsent
  });
}
