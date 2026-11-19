import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { AUTHORIZATION_MAX_AGE, entraIdentity, entraTenant } from '@/lib/auth-policy';

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
  const tenant = entraTenant(issuer);
  return {
    // Only trust the deployment host when running behind Vercel or explicitly configured.
    trustHost:
      process.env.VERCEL === '1' ||
      process.env.NODE_ENV !== 'production' ||
      process.env.AUTH_TRUST_HOST === 'true',
    session: { strategy: 'jwt', maxAge: AUTHORIZATION_MAX_AGE },
    pages: { signIn: '/login', error: '/login' },
    providers: tenant
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer,
            authorization: { params: { scope: 'openid profile email' } },
            checks: ['pkce', 'state', 'nonce'],
            // No Graph/mail permissions or profile-photo fetch needed for sign-in.
            profile(profile) {
              return { id: profile.oid, name: profile.name, email: null, image: null };
            },
          }),
        ]
      : [],
    callbacks: {
      signIn({ account, profile }) {
        return (
          account?.provider === 'microsoft-entra-id' && Boolean(entraIdentity(profile, tenant))
        );
      },
      jwt({ token, profile, account }) {
        if (account) {
          const identity = entraIdentity(profile, tenant);
          if (!identity) return null;
          token.objectId = identity.objectId;
          token.tenantId = identity.tenantId;
          token.name = identity.name;
          token.isAdmin = identity.isAdmin;
          token.authorizedUntil = Math.floor(Date.now() / 1000) + AUTHORIZATION_MAX_AGE;
        }
        // Fixed authorization lifetime: session refresh/update cannot prolong old Entra roles.
        if (
          token.tenantId !== tenant ||
          typeof token.authorizedUntil !== 'number' ||
          token.authorizedUntil <= Date.now() / 1000
        )
          return null;
        return token;
      },
      session({ session, token }) {
        session.user.id = String(token.objectId);
        session.user.tenantId = String(token.tenantId);
        session.user.isAdmin = token.isAdmin === true;
        session.user.authorizedUntil = Number(token.authorizedUntil);
        return session;
      },
    },
  };
});
