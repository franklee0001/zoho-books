import { syncInvoices } from "@/lib/zoho-sync";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const full = Boolean(body.full);
    const result = await syncInvoices({ full });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Invoice sync error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
