import { syncInvoices } from "@/lib/zoho-sync";
import { NextRequest, NextResponse } from "next/server";

function verifyCron(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncInvoices();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron sync-invoices error:", error);
    return NextResponse.json(
      { error: "Cron sync failed" },
      { status: 500 },
    );
  }
}
