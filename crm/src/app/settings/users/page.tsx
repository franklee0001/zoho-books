import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getLocale } from "@/lib/get-locale";
import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./client";

export default async function SettingsUsersPage() {
  const session = await getSession(await cookies());
  if (!session || session.role !== "admin") redirect("/settings");

  const locale = await getLocale();
  const users = await prisma.allowedUser.findMany({
    orderBy: { created_at: "desc" },
  });

  return <AdminUsersClient locale={locale} users={users} currentEmail={session.email} />;
}
