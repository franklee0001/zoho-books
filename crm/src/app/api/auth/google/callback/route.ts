import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeAuthCode,
  getGoogleUser,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  try {
    const tokens = await exchangeAuthCode(code);
    const user = await getGoogleUser(tokens.access_token);

    // Check whitelist
    const allowed = await prisma.allowedUser.findUnique({
      where: { email: user.email },
    });

    if (!allowed) {
      return NextResponse.redirect(
        new URL("/login?error=not_allowed", request.url),
      );
    }

    // Create session
    const token = await createSessionToken({
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: allowed.role,
    });

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
