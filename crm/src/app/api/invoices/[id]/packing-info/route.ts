import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const lineItems = await prisma.invoiceLineItem.findMany({
      where: { invoice_id: id },
      include: { packingInfo: true },
      orderBy: { created_at: "asc" },
    });

    const result = lineItems.map((li, idx) => ({
      line_item_id: li.line_item_id,
      name: li.name,
      sku: li.sku,
      quantity: li.quantity ? Number(li.quantity) : 0,
      packingInfo: li.packingInfo
        ? {
            packing_no: li.packingInfo.packing_no ?? idx + 1,
            length_mm: li.packingInfo.length_mm
              ? Number(li.packingInfo.length_mm)
              : 0,
            width_mm: li.packingInfo.width_mm
              ? Number(li.packingInfo.width_mm)
              : 0,
            height_mm: li.packingInfo.height_mm
              ? Number(li.packingInfo.height_mm)
              : 0,
            package_type: li.packingInfo.package_type ?? "BOX",
            net_weight_kg: li.packingInfo.net_weight_kg
              ? Number(li.packingInfo.net_weight_kg)
              : 0,
            gross_weight_kg: li.packingInfo.gross_weight_kg
              ? Number(li.packingInfo.gross_weight_kg)
              : 0,
          }
        : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/invoices/[id]/packing-info error:", error);
    return NextResponse.json(
      { error: "Failed to fetch packing info" },
      { status: 500 }
    );
  }
}

interface PackingInfoItem {
  line_item_id: string;
  packing_no?: number;
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  package_type?: string;
  net_weight_kg?: number;
  gross_weight_kg?: number;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const items: PackingInfoItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Request body must contain a non-empty items array" },
        { status: 400 }
      );
    }

    // Verify invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: id },
      select: { invoice_id: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Upsert each packing info item
    const results = await Promise.all(
      items.map((item) =>
        prisma.invoicePackingInfo.upsert({
          where: { line_item_id: item.line_item_id },
          create: {
            invoice_id: id,
            line_item_id: item.line_item_id,
            packing_no: item.packing_no,
            length_mm: item.length_mm,
            width_mm: item.width_mm,
            height_mm: item.height_mm,
            package_type: item.package_type ?? "BOX",
            net_weight_kg: item.net_weight_kg,
            gross_weight_kg: item.gross_weight_kg,
          },
          update: {
            packing_no: item.packing_no,
            length_mm: item.length_mm,
            width_mm: item.width_mm,
            height_mm: item.height_mm,
            package_type: item.package_type ?? "BOX",
            net_weight_kg: item.net_weight_kg,
            gross_weight_kg: item.gross_weight_kg,
            updated_at: new Date(),
          },
        })
      )
    );

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error("PUT /api/invoices/[id]/packing-info error:", error);
    return NextResponse.json(
      { error: "Failed to update packing info" },
      { status: 500 }
    );
  }
}
