import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// DELETE /api/ai-chat/documents/[id] — delete document and its chunks
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const docId = parseInt(id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.ragDocument.delete({
      where: { id: docId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/ai-chat/documents/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
