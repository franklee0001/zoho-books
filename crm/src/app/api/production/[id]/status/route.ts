import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = ["confirmed", "producing", "checking", "packing", "shipped"] as const;
type Status = (typeof VALID_STATUSES)[number];

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
    const { status, changed_by, note } = body as {
      status: string;
      changed_by?: string;
      note?: string;
    };

    if (!VALID_STATUSES.includes(status as Status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    if (order.status === status) {
      return NextResponse.json({ error: "Status is already " + status }, { status: 400 });
    }

    // Transaction: update order + create status log
    const now = new Date();
    const updateData: Record<string, unknown> = {
      status,
      updated_at: now,
    };

    if (status === "checking") {
      updateData.completed_at = now;
    } else if (status === "shipped") {
      updateData.shipped_at = now;
    }

    const [updated] = await prisma.$transaction([
      prisma.productionOrder.update({
        where: { id: orderId },
        data: updateData,
      }),
      prisma.productionStatusLog.create({
        data: {
          production_order_id: orderId,
          old_status: order.status,
          new_status: status,
          changed_by: changed_by || "unknown",
          note: note || null,
        },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/production/[id]/status error:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
