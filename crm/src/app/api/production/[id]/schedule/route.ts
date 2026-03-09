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
    const { shipping_deadline, production_start_date, production_end_date } = body as {
      shipping_deadline?: string | null;
      production_start_date?: string | null;
      production_end_date?: string | null;
    };

    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (shipping_deadline !== undefined) {
      updateData.shipping_deadline = shipping_deadline ? new Date(shipping_deadline) : null;
    }
    if (production_start_date !== undefined) {
      updateData.production_start_date = production_start_date ? new Date(production_start_date) : null;
    }
    if (production_end_date !== undefined) {
      updateData.production_end_date = production_end_date ? new Date(production_end_date) : null;
    }

    const updated = await prisma.productionOrder.update({
      where: { id: orderId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/production/[id]/schedule error:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}
