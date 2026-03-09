import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const stage = searchParams.get("stage");
    const country = searchParams.get("country");
    const q = searchParams.get("q");

    const where: Record<string, unknown> = {};
    if (stage && stage !== "all") where.stage = stage;
    if (country) where.country_code = country;
    if (q) {
      where.OR = [
        { company_name: { contains: q, mode: "insensitive" } },
        { contact_name: { contains: q, mode: "insensitive" } },
        { country_name: { contains: q, mode: "insensitive" } },
      ];
    }

    const distributors = await prisma.distributor.findMany({
      where,
      include: {
        customer: { select: { customer_id: true, customer_name: true } },
      },
      orderBy: { updated_at: "desc" },
    });

    return NextResponse.json(distributors);
  } catch (error) {
    console.error("GET /api/distributors error:", error);
    const msg = error instanceof Error ? error.message : "Failed to fetch distributors";
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    if (!company_name || !country_code || !country_name) {
      return NextResponse.json(
        { error: "company_name, country_code, and country_name are required" },
        { status: 400 },
      );
    }

    const distributor = await prisma.distributor.create({
      data: {
        company_name,
        contact_name: contact_name || null,
        email: email || null,
        country_code,
        country_name,
        product_scope: product_scope || "all",
        products: products || null,
        stage: stage || "lead",
        notes: notes || null,
        customer_id: customer_id || null,
      },
    });

    return NextResponse.json(distributor, { status: 201 });
  } catch (error) {
    console.error("POST /api/distributors error:", error);
    return NextResponse.json(
      { error: "Failed to create distributor" },
      { status: 500 },
    );
  }
}
