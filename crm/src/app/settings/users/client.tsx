"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

interface AllowedUser {
  email: string;
  role: string;
  created_at: Date;
}

export default function AdminUsersClient({
  locale,
  users: initialUsers,
  currentEmail,
}: {
  locale: Locale;
  users: AllowedUser[];
  currentEmail: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
    });

    if (res.ok) {
      const user = await res.json();
      setUsers((prev) => {
        const filtered = prev.filter((u) => u.email !== user.email);
        return [user, ...filtered];
      });
      setEmail("");
      setRole("member");
    }
    setAdding(false);
  }

  async function handleDelete(userEmail: string) {
    if (userEmail === currentEmail) {
      alert(t(locale, "admin.cannotDeleteSelf"));
      return;
    }
    if (!confirm(t(locale, "admin.deleteConfirm"))) return;

    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail }),
    });

    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.email !== userEmail));
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t(locale, "admin.users")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t(locale, "admin.usersSubtitle")}
        </p>
      </div>

      {/* Add user form */}
      <form onSubmit={handleAdd} className="flex gap-3 mb-6">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t(locale, "admin.emailPlaceholder")}
          required
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="admin">admin</option>
          <option value="member">member</option>
        </select>
        <button
          type="submit"
          disabled={adding}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {adding ? t(locale, "admin.adding") : t(locale, "admin.add")}
        </button>
      </form>

      {/* User list */}
      {users.length === 0 ? (
        <p className="text-gray-500 text-sm">{t(locale, "admin.noUsers")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="pb-2 font-medium">{t(locale, "admin.email")}</th>
              <th className="pb-2 font-medium">{t(locale, "admin.role")}</th>
              <th className="pb-2 font-medium">{t(locale, "admin.createdAt")}</th>
              <th className="pb-2 font-medium">{t(locale, "admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.email} className="border-b border-gray-100">
                <td className="py-3">
                  {user.email}
                  {user.email === currentEmail && (
                    <span className="ml-2 text-xs text-blue-600 font-medium">(you)</span>
                  )}
                </td>
                <td className="py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="py-3 text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="py-3">
                  {user.email !== currentEmail && (
                    <button
                      onClick={() => handleDelete(user.email)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      {t(locale, "common.delete")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
