import { prisma } from "@/lib/prisma";
import { generateDocuments } from "@/lib/pdf/generate";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Optional API secret check for external callers
  const apiSecret = request.headers.get("x-api-secret");
  if (apiSecret) {
    const expectedSecret = process.env.SYNC_API_SECRET;
    if (!expectedSecret || apiSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Validate invoice exists and has line items
    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: id },
      include: {
        lineItems: {
          include: { packingInfo: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.lineItems.length === 0) {
      return NextResponse.json(
        { error: "Invoice has no line items" },
        { status: 400 }
      );
    }

    // Generate documents
    const documents = await generateDocuments(id);

    return NextResponse.json({ documents });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/invoices/[id]/generate-documents error:", msg, error);
    return NextResponse.json(
      { error: msg || "Failed to generate documents" },
      { status: 500 }
    );
  }
}
