"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useCallback, useRef } from "react";
import { t, type Locale } from "@/lib/i18n";
import MessageList from "./message-list";
import ChatInput from "./chat-input";
import DocumentPanel from "./document-panel";

interface Conversation {
  id: number;
  title: string | null;
  updated_at: string;
  message_count: number;
}

export default function ChatClient({ locale }: { locale: Locale }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const conversationIdRef = useRef<number | null>(null);
  conversationIdRef.current = activeConversationId;

  const { messages, status, setMessages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai-chat",
      body: () => ({
        conversationId: conversationIdRef.current,
        locale,
      }),
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const createNewChat = async () => {
    try {
      const res = await fetch("/api/ai-chat/conversations", { method: "POST" });
      if (res.ok) {
        const conv = await res.json();
        setActiveConversationId(conv.id);
        setMessages([]);
        loadConversations();
      }
    } catch {
      // ignore
    }
  };

  const loadConversation = async (id: number) => {
    setActiveConversationId(id);
    try {
      const res = await fetch(`/api/ai-chat/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(
          data.messages.map((m: { id: number; role: string; content: string }) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: m.content }],
          })),
        );
      }
    } catch {
      // ignore
    }
  };

  const deleteConversation = async (id: number) => {
    try {
      await fetch(`/api/ai-chat/conversations/${id}`, { method: "DELETE" });
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
      loadConversations();
    } catch {
      // ignore
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    await sendMessage({ text });
    // Refresh conversations to pick up new title
    setTimeout(loadConversations, 2000);
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">
      {/* Sidebar: conversations */}
      <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={createNewChat}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + {t(locale, "aiChat.newChat")}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              {t(locale, "aiChat.noConversations")}
            </p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                activeConversationId === conv.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => loadConversation(conv.id)}
            >
              <span className="flex-1 truncate">
                {conv.title || t(locale, "aiChat.newChat")}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                title={t(locale, "aiChat.deleteConversation")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={() => setShowDocs(!showDocs)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showDocs
                ? "bg-purple-50 text-purple-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {t(locale, "aiChat.documents")}
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">{t(locale, "aiChat.title")}</h1>
          <p className="text-xs text-gray-500">{t(locale, "aiChat.subtitle")}</p>
        </div>
        <MessageList messages={messages} isLoading={isLoading} locale={locale} />
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          locale={locale}
          disabled={!activeConversationId}
          onCreateChat={createNewChat}
        />
      </div>

      {/* Document panel */}
      {showDocs && (
        <div className="w-80 flex-shrink-0">
          <DocumentPanel locale={locale} />
        </div>
      )}
    </div>
  );
}
