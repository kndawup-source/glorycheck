import {
  adminClient,
  requireSuperAdmin
} from './_supabase.js';

export default async function handler(req, res) {

  const auth =
    await requireSuperAdmin(req, res);

  if (!auth) return;

  const supabase =
    adminClient();

  const { data: churches, error } =
    await supabase
      .from('churches')
      .select('*')
      .order('created_at', {
        ascending: false
      });

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  const [
    membersRes,
    attendanceRes,
    profilesRes
  ] = await Promise.all([

    supabase
      .from('members')
      .select('id, church_id, status'),

    supabase
      .from('attendance')
      .select('id, church_id, checked_at, status'),

    supabase
      .from('profiles')
      .select('id, church_id, name, role, system_role')
  ]);

  const members =
    membersRes.data || [];

  const attendance =
    attendanceRes.data || [];

  const profiles =
    profilesRes.data || [];

  const summary =
    (churches || []).map(church => {

      const churchMembers =
        members.filter(m =>
          m.church_id === church.id
        );

      const churchAttendance =
        attendance.filter(a =>
          a.church_id === church.id
        );

      const churchAdmins =
        profiles.filter(p =>
          p.church_id === church.id &&
          p.system_role !== 'super_admin'
        );

      return {
        ...church,
        member_count: churchMembers.length,
        active_member_count:
          churchMembers.filter(m =>
            m.status === 'active'
          ).length,
        attendance_count:
          churchAttendance.length,
        admin_count:
          churchAdmins.length
      };
    });

  res.status(200).json({
    profile: auth.profile,

    churches: summary,

    totals: {
      churches: summary.length,
      active_churches:
        summary.filter(c =>
          c.status === 'active'
        ).length,
      members: members.length,
      attendance: attendance.length
    }
  });
}
