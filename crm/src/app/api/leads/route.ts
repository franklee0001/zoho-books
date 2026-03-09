import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.LeadWhereInput = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
    ];
  }

  if (status !== "all") {
    where.deal_status = status;
  }

  try {
    const [leads, total, groupResult] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ["deal_status"],
        _count: { deal_status: true },
        ...(q
          ? {
              where: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { company: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { country: { contains: q, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    let allCount = 0;
    for (const g of groupResult) {
      if (g.deal_status) {
        statusCounts[g.deal_status] = g._count.deal_status;
        allCount += g._count.deal_status;
      }
    }
    statusCounts.all = allCount;

    return NextResponse.json({ leads, total, statusCounts, page, pageSize });
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { unique_key, ...data } = body;

    if (!unique_key) {
      return NextResponse.json(
        { error: "unique_key is required" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.create({
      data: { unique_key, ...data },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads error:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 },
    );
  }
}
