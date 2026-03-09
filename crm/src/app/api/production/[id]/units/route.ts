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
    const { units } = body as {
      units: {
        id: number;
        serial_number?: string | null;
        is_completed?: boolean;
      }[];
    };

    if (!Array.isArray(units)) {
      return NextResponse.json({ error: "units must be an array" }, { status: 400 });
    }

    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    const now = new Date();
    await prisma.$transaction(
      units.map((u) =>
        prisma.productionUnit.update({
          where: { id: u.id },
          data: {
            serial_number: u.serial_number ?? undefined,
            is_completed: u.is_completed ?? undefined,
            completed_at: u.is_completed ? now : u.is_completed === false ? null : undefined,
          },
        })
      )
    );

    // Update production order timestamp
    await prisma.productionOrder.update({
      where: { id: orderId },
      data: { updated_at: now },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/production/[id]/units error:", error);
    return NextResponse.json(
      { error: "Failed to update units" },
      { status: 500 }
    );
  }
}
