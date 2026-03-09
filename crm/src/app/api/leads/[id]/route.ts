import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  findRowByUniqueKey,
  getSheetHeaders,
  colIndexToLetter,
  updateSheetCells,
} from "@/lib/google-sheets";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leadId = parseInt(id, 10);

  if (isNaN(leadId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json(lead);
  } catch (error) {
    console.error("GET /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 },
    );
  }
}

// Editable fields that sync back to Sheets
const EDITABLE_FIELDS = ["notes", "deal_status", "order_status", "amount"];

// Map DB field names to possible Sheets header names
const FIELD_TO_SHEET_HEADER: Record<string, string[]> = {
  notes: ["notes", "Notes"],
  deal_status: ["deal_status", "Deal_Status", "Deal Status", "DealStatus"],
  order_status: [
    "order_status",
    "Order_Status",
    "Order Status",
    "OrderStatus",
  ],
  amount: ["amount", "Amount"],
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leadId = parseInt(id, 10);

  if (isNaN(leadId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Only allow editable fields
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] =
          field === "amount"
            ? body[field] === "" || body[field] === null
              ? null
              : parseFloat(body[field])
            : body[field] || null;
      }
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    // Reverse sync to Google Sheets
    try {
      const rowNum = await findRowByUniqueKey(lead.unique_key);
      if (rowNum) {
        const headers = await getSheetHeaders();
        const updates: { range: string; value: string }[] = [];

        for (const field of EDITABLE_FIELDS) {
          if (body[field] !== undefined) {
            const possibleHeaders = FIELD_TO_SHEET_HEADER[field] ?? [field];
            const colIdx = headers.findIndex((h) =>
              possibleHeaders.some(
                (ph) => h.toLowerCase() === ph.toLowerCase(),
              ),
            );
            if (colIdx !== -1) {
              const colLetter = colIndexToLetter(colIdx);
              updates.push({
                range: `${colLetter}${rowNum}`,
                value: String(body[field] ?? ""),
              });
            }
          }
        }

        if (updates.length > 0) {
          await updateSheetCells(updates);
        }
      }
    } catch (sheetErr) {
      console.error("Reverse sync to Sheets failed:", sheetErr);
      // Don't fail the request — DB update succeeded
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("PUT /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leadId = parseInt(id, 10);

  if (isNaN(leadId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    await prisma.lead.delete({ where: { id: leadId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 },
    );
  }
}
