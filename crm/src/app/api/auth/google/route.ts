import { redirect } from "next/navigation";
import { getAuthUrl } from "@/lib/auth";

export async function GET() {
  redirect(getAuthUrl());
}
