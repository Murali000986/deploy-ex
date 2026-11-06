import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { USERS } from "./mock-data";
import type { Role } from "./types";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = USERS.find(u => u.email.toLowerCase() === String(creds.email).toLowerCase());
        if (!user) return null;
        if (!user.active) throw new Error("ACCOUNT_DISABLED");
        const expected = user.passwordHash.replace(/^plain:/, "");
        if (expected !== creds.password) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role as Role;
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};

declare module "next-auth" {
  interface Session {
    user: { id?: string; name?: string | null; email?: string | null; image?: string | null; role?: Role };
  }
}
