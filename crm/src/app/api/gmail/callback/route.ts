import { prisma } from "@/lib/prisma";
import { exchangeCode, getUserEmail } from "@/lib/gmail";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/emails?error=auth_denied", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/emails?error=no_code", request.url));
  }

  try {
    const tokens = await exchangeCode(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/emails?error=no_refresh_token", request.url));
    }

    const email = await getUserEmail(tokens.access_token);
    const expiry = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.gmailToken.upsert({
      where: { email },
      create: {
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiry,
      },
      update: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiry,
        updated_at: new Date(),
      },
    });

    return NextResponse.redirect(new URL("/emails?connected=true", request.url));
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(new URL("/emails?error=token_exchange", request.url));
  }
}
