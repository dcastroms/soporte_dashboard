/**
 * Custom NextAuth adapter backed by the MongoDB proxy Lambda.
 * Compatible con JWT session strategy — los métodos de sesión no se invocan,
 * pero se implementan por completitud y para soporte de OAuth (Google).
 */
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from "next-auth/adapters";
import {
  findUserById,
  findUserByEmail,
  createUser,
  updateUser,
} from "@/lib/models/UserModel";
import {
  findAccountByProvider,
  createAccount,
  findSessionByToken,
  createSession,
  updateSession,
  deleteSession,
  createVerificationToken,
  findAndDeleteVerificationToken,
} from "@/lib/models/AuthModel";

function toAdapterUser(doc: any): AdapterUser {
  return {
    id: doc.id,
    email: doc.email,
    name: doc.name ?? null,
    image: doc.image ?? null,
    emailVerified: doc.emailVerified ? new Date(doc.emailVerified) : null,
  };
}

export function MongoAdapter(): Adapter {
  return {
    async createUser(user) {
      const doc = await createUser({
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        role: "USER",
        permissions: [],
      });
      return toAdapterUser(doc);
    },

    async getUser(id) {
      const doc = await findUserById(id);
      return doc ? toAdapterUser(doc) : null;
    },

    async getUserByEmail(email) {
      const doc = await findUserByEmail(email);
      return doc ? toAdapterUser(doc) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await findAccountByProvider(provider, providerAccountId);
      if (!account) return null;
      const user = await findUserById(account.userId);
      return user ? toAdapterUser(user) : null;
    },

    async updateUser(user) {
      const doc = await updateUser(user.id, {
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        emailVerified: user.emailVerified?.toISOString() ?? undefined,
      });
      return toAdapterUser(doc ?? user);
    },

    async linkAccount(account) {
      await createAccount({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token ?? null,
        access_token: account.access_token ?? null,
        expires_at: account.expires_at ?? null,
        token_type: account.token_type ?? null,
        scope: account.scope ?? null,
        id_token: account.id_token ?? null,
        session_state: (account.session_state as string) ?? null,
      });
      return account;
    },

    async createSession(session) {
      const doc = await createSession({
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires.toISOString(),
      });
      return { sessionToken: doc.sessionToken, userId: doc.userId, expires: new Date(doc.expires) };
    },

    async getSessionAndUser(sessionToken) {
      const session = await findSessionByToken(sessionToken);
      if (!session) return null;
      const user = await findUserById(session.userId);
      if (!user) return null;
      return {
        session: { sessionToken: session.sessionToken, userId: session.userId, expires: new Date(session.expires) },
        user: toAdapterUser(user),
      };
    },

    async updateSession(session) {
      const doc = await updateSession(session.sessionToken, {
        expires: session.expires?.toISOString(),
      });
      if (!doc) return null;
      return { sessionToken: doc.sessionToken, userId: doc.userId, expires: new Date(doc.expires) };
    },

    async deleteSession(sessionToken) {
      await deleteSession(sessionToken);
    },

    async createVerificationToken(verificationToken) {
      await createVerificationToken({
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        expires: verificationToken.expires.toISOString(),
      });
      return verificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      const doc = await findAndDeleteVerificationToken(identifier, token);
      if (!doc) return null;
      return { identifier: doc.identifier, token: doc.token, expires: new Date(doc.expires) };
    },
  };
}
