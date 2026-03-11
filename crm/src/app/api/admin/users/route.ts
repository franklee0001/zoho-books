import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.allowedUser.findMany({
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const { email, role } = await request.json();

  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }

  const user = await prisma.allowedUser.upsert({
    where: { email },
    update: { role },
    create: { email, role },
  });

  return NextResponse.json(user);
}

export async function DELETE(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  await prisma.allowedUser.delete({ where: { email } });
  return NextResponse.json({ ok: true });
}
