import { UserRole } from '../../domain/entities.js';
import {
  AuthorizationError,
  DomainError,
  DomainValidationError,
  NotFoundError,
} from '../../domain/errors.js';
import { assertCanManageUsers } from '../../domain/rules.js';
import { normalizeAcademicBlock } from '../../domain/valueObjects.js';

export function createUserUseCases({
  userRepo,
  auditLogPort,
  domainPolicy,
  passwordHasher,
  adminBootstrapEmails = [],
}) {
  const normalizedBootstrapAdmins = adminBootstrapEmails.map((e) =>
    String(e).trim().toLowerCase()
  );

  return {

    async authenticateWithEmailPassword({ email, password } = {}) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const rawPassword = String(password ?? '');
      if (!normalizedEmail || !rawPassword) {
        throw new DomainValidationError('University email and password are required.');
      }

      const isBootstrapAdmin = normalizedBootstrapAdmins.includes(normalizedEmail);
      if (!isBootstrapAdmin) {
        domainPolicy.assertEmailAllowed(normalizedEmail);
      }

      const record = await userRepo.findAuthRecordByEmail(normalizedEmail);
      if (!record || !record.passwordHash || record.isDemo) {
        throw new DomainError(
          'Invalid university email or password.',
          'INVALID_CREDENTIALS',
          401
        );
      }

      const validPassword = passwordHasher.verifyPassword(rawPassword, record.passwordHash);
      if (!validPassword) {
        throw new DomainError(
          'Invalid university email or password.',
          'INVALID_CREDENTIALS',
          401
        );
      }

      if (!record.isActive) {
        throw new AuthorizationError('This user account has been deactivated by an administrator.');
      }

      if (!record.emailVerified) {
        throw new DomainError(
          'Please verify your university email address before signing in. Open your verification link or request a new one.',
          'EMAIL_NOT_VERIFIED',
          403
        );
      }

      return {
        id: record.id,
        uid: record.uid,
        email: record.email,
        fullName: record.fullName,
        role: record.role,
        department: record.department,
        academicBlock: record.academicBlock || null,
        authProvider: record.authProvider || 'password',
        emailVerified: true,
        isActive: Boolean(record.isActive),
      };
    },

    async setOwnPassword(actor, { password, confirmPassword } = {}) {
      const rawPassword = String(password || '');
      const confirmation = String(confirmPassword || '');
      if (rawPassword.length < 12) {
        throw new DomainValidationError('FaCICuSe passwords must be at least 12 characters long.');
      }
      if (rawPassword.length > 128) {
        throw new DomainValidationError('FaCICuSe passwords must be 128 characters or fewer.');
      }
      if (rawPassword !== confirmation) {
        throw new DomainValidationError('The password confirmation does not match.');
      }
      if (!actor?.uid || !actor.emailVerified || !actor.isActive) {
        throw new AuthorizationError('A verified, active university account is required to set a password.');
      }

      const passwordHash = passwordHasher.hashPassword(rawPassword);
      const updated = await userRepo.setPasswordByUid(actor.uid, passwordHash);
      if (!updated) {
        throw new NotFoundError('University account not found. Please sign in again.');
      }
      return updated;
    },

    async syncVerifiedGoogleUser(decodedToken, requestedProfile = {}) {
      if (decodedToken?.email_verified === false) {
        throw new DomainError(
          'Your Google / Firebase email address must be verified before signing in.',
          'EMAIL_NOT_VERIFIED',
          403
        );
      }

      const normalizedEmail = String(decodedToken?.email || '').trim().toLowerCase();
      const isBootstrapAdmin = normalizedBootstrapAdmins.includes(normalizedEmail);
      const verifiedEmail = isBootstrapAdmin
        ? normalizedEmail
        : domainPolicy.assertEmailAllowed(normalizedEmail);

      const existing =
        (await userRepo.findByUid(decodedToken.uid)) ||
        (await userRepo.findByEmail(verifiedEmail));

      // Never allow public admin registration; only bootstrap emails or existing admins get admin role
      let resolvedRole = UserRole.STUDENT;
      if (existing) {
        resolvedRole = existing.role;
      } else if (isBootstrapAdmin) {
        resolvedRole = UserRole.ADMIN;
      }

      const fullName =
        String(requestedProfile.fullName || decodedToken.name || '').trim() ||
        verifiedEmail.split('@')[0];

      const user = await userRepo.upsertVerifiedUser({
        uid: decodedToken.uid,
        email: verifiedEmail,
        fullName,
        role: resolvedRole,
        department: requestedProfile.department
          ? String(requestedProfile.department).trim()
          : existing?.department || 'College of Informatics and Computing Sciences (CICS)',
      });

      if (!user.isActive) {
        throw new AuthorizationError('This user account has been deactivated by an administrator.');
      }

      return user;
    },

    async updateOwnProfile(actor, payload) {
      const fullName = String(payload.fullName || actor.fullName).trim();
      const department = String(payload.department || actor.department || '').trim();
      const academicBlock =
        payload.academicBlock !== undefined
          ? normalizeAcademicBlock(payload.academicBlock)
          : undefined;
      if (fullName.length < 2 || fullName.length > 100) {
        throw new DomainValidationError('Full name must be between 2 and 100 characters.');
      }
      return userRepo.updateProfile(actor.id, { fullName, department, academicBlock });
    },

    async listUsersForAdmin(actor) {
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only System Administrators may view user accounts.');
      }
      return userRepo.listAll();
    },

    async updateUserForAdmin(actor, targetUserId, payload) {
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only System Administrators may modify user accounts.');
      }
      const id = Number(targetUserId);
      const targetUser = await userRepo.findById(id);
      if (!targetUser) {
        throw new NotFoundError('User account not found.');
      }

      const nextRole = payload.role ? String(payload.role).toLowerCase() : targetUser.role;
      const nextIsActive =
        typeof payload.isActive === 'boolean' ? payload.isActive : targetUser.isActive;
      const nextAcademicBlock =
        payload.academicBlock !== undefined
          ? normalizeAcademicBlock(payload.academicBlock)
          : undefined;

      if (actor.id === targetUser.id && nextRole !== UserRole.ADMIN) {
        throw new DomainValidationError('You cannot remove your own System Administrator role.');
      }

      assertCanManageUsers(actor.role, targetUser, nextRole, nextIsActive);

      const updated = await userRepo.updateUserAccount(id, {
        role: nextRole,
        isActive: nextIsActive,
        department:
          payload.department !== undefined
            ? String(payload.department).trim()
            : targetUser.department,
        academicBlock: nextAcademicBlock,
      });

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'USER_UPDATED',
        entityType: 'user',
        entityId: String(id),
        details: `Updated ${targetUser.email} role=${nextRole}, active=${nextIsActive}`,
      });

      return updated;
    },
  };
}
