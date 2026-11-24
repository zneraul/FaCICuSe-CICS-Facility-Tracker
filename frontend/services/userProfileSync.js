const ACADEMIC_BLOCK_PATTERN = /^IT-[1-4][12][0-9]{2}$/;

export function buildUserProfileCreateFields(firebaseUser, profile) {
  if (!firebaseUser?.uid || !firebaseUser.email || !profile) return null;

  const fullName = String(profile.fullName || firebaseUser.displayName || 'Campus User')
    .trim()
    .slice(0, 100);
  const department = String(
    profile.department || 'College of Informatics and Computing Sciences (CICS)'
  ).trim().slice(0, 120);
  const role = ['student', 'professor', 'admin'].includes(profile.role)
    ? profile.role
    : 'student';
  const academicBlock = String(profile.academicBlock || '').trim();

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    fullName: fullName.length >= 2 ? fullName : 'Campus User',
    role,
    department,
    ...(ACADEMIC_BLOCK_PATTERN.test(academicBlock) ? { academicBlock } : {}),
    emailVerified: true,
    isActive: true,
  };
}

export function buildUserProfileUpdateFields(profile, firebaseUser) {
  if (!profile || !firebaseUser?.uid) return null;

  const fullName = String(profile.fullName || firebaseUser.displayName || 'Campus User')
    .trim()
    .slice(0, 100);
  const department = String(
    profile.department || 'College of Informatics and Computing Sciences (CICS)'
  ).trim().slice(0, 120);
  const academicBlock = String(profile.academicBlock || '').trim();

  return {
    fullName: fullName.length >= 2 ? fullName : 'Campus User',
    department,
    ...(ACADEMIC_BLOCK_PATTERN.test(academicBlock) ? { academicBlock } : {}),
  };
}
