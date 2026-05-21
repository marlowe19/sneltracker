/**
 * Returns true if the user has full owner-level access on this project.
 *
 * Two ways to qualify:
 *  1. The user is the project creator (projects.owner_name === user) — is_owner flag
 *  2. The user has been assigned the "owner" role in project_members — member_role / members[]
 *
 * Keep is_owner (creator) separate in places where only the original creator
 * should act, e.g. delete project. Use this helper for data-visibility and
 * management capabilities that a promoted owner should also have.
 *
 * @param {Object} project - Project object with is_owner, member_role, and/or members[]
 * @param {string} userName - The current user's username (auth0 sub)
 * @returns {boolean}
 */
export function isProjectOwnerLevel(project, userName) {
  if (!project) return false;

  // Project creator always qualifies
  if (project.is_owner) return true;

  // member_role is pre-resolved on list queries (get_user_projects_with_stats)
  // and on detail queries (getProjectDetail adds it from members[])
  if (project.member_role === "owner") return true;

  // Fallback: scan members array when member_role isn't pre-resolved
  if (Array.isArray(project.members)) {
    const member = project.members.find((m) => m.user_name === userName);
    if (member?.role === "owner") return true;
  }

  return false;
}
