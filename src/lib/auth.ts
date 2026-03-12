import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) return null;

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async session({ session, user, token }) {
      if (session.user) {
        if (token) {
          session.user.id = (token as any).sub as string;
          (session.user as any).role = (token as any).role as string;
        } else if (user) {
          session.user.id = user.id;
          (session.user as any).role = (user as any).role as string;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
        if (user) {
            token.id = user.id;
            token.role = (user as any).role; 
        }
        return token;
    },
    async signIn({ user, account, profile }) {
      // Restricción de dominio @mediastre.am
      if (user.email && user.email.endsWith('@mediastre.am')) {
        return true;
      }
      return false; // Bloquear si no es el dominio correcto
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
