import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        customer_id: true,
        customer_name: true,
        email: true,
        country: true,
      },
      orderBy: { customer_name: "asc" },
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error("GET /api/customers/search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 },
    );
  }
}
