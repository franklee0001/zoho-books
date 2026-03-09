import { getLocale } from "@/lib/get-locale";
import ChatClient from "./chat-client";

export const dynamic = "force-dynamic";

export default async function AiChatPage() {
  const locale = await getLocale();
  return <ChatClient locale={locale} />;
}
