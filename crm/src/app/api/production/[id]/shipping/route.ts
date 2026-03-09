import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = parseInt(id, 10);

  if (isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { tracking_number, shipping_method } = body as {
      tracking_number?: string | null;
      shipping_method?: string | null;
    };

    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    const updated = await prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        tracking_number: tracking_number ?? undefined,
        shipping_method: shipping_method ?? undefined,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/production/[id]/shipping error:", error);
    return NextResponse.json(
      { error: "Failed to update shipping info" },
      { status: 500 }
    );
  }
}
