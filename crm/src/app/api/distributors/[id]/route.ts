import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const distributorId = parseInt(id, 10);

  if (isNaN(distributorId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const distributor = await prisma.distributor.findUnique({
      where: { id: distributorId },
      include: {
        customer: {
          select: {
            customer_id: true,
            customer_name: true,
            email: true,
            invoices: {
              select: {
                invoice_id: true,
                invoice_number: true,
                date: true,
                status: true,
                total: true,
                currency_code: true,
              },
              orderBy: { date: "desc" },
              take: 20,
            },
          },
        },
      },
    });

    if (!distributor) {
      return NextResponse.json(
        { error: "Distributor not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(distributor);
  } catch (error) {
    console.error("GET /api/distributors/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch distributor" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const distributorId = parseInt(id, 10);

  if (isNaN(distributorId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      company_name,
      contact_name,
      email,
      country_code,
      country_name,
      product_scope,
      products,
      stage,
      notes,
      customer_id,
    } = body;

    const distributor = await prisma.distributor.update({
      where: { id: distributorId },
      data: {
        ...(company_name !== undefined && { company_name }),
        ...(contact_name !== undefined && { contact_name: contact_name || null }),
        ...(email !== undefined && { email: email || null }),
        ...(country_code !== undefined && { country_code }),
        ...(country_name !== undefined && { country_name }),
        ...(product_scope !== undefined && { product_scope }),
        ...(products !== undefined && { products: products || null }),
        ...(stage !== undefined && { stage }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(customer_id !== undefined && {
          customer_id: customer_id || null,
        }),
        updated_at: new Date(),
      },
    });

    return NextResponse.json(distributor);
  } catch (error) {
    console.error("PUT /api/distributors/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update distributor" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const distributorId = parseInt(id, 10);

  if (isNaN(distributorId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    await prisma.distributor.delete({ where: { id: distributorId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/distributors/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete distributor" },
      { status: 500 },
    );
  }
}
