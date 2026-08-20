import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { prisma } from "./db.js";

const COOKIE = "agape_session";
const TWO_WEEKS = 60 * 60 * 24 * 14;

export async function login(c: Context, email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  const id = nanoid(32);
  await prisma.session.create({
    data: {
      id,
      userId: user.id,
      expiresAt: new Date(Date.now() + TWO_WEEKS * 1000),
    },
  });
  setCookie(c, COOKIE, id, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    maxAge: TWO_WEEKS,
  });
  return { id: user.id, email: user.email, name: user.name };
}

export async function logout(c: Context) {
  const id = getCookie(c, COOKIE);
  if (id) await prisma.session.deleteMany({ where: { id } });
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function currentUser(c: Context) {
  const id = getCookie(c, COOKIE);
  if (!id) return null;
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id } });
    return null;
  }
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  });
}

export async function requireAuth(c: Context, next: Next) {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  await next();
}

declare module "hono" {
  interface ContextVariableMap {
    user: { id: string; email: string; name: string };
  }
}
