
"use client";

import { FC, useEffect, useState } from "react";
import { useAuth } from "@/app/AuthContext";

interface Analyst {
  id: string; // treat as string to support UUID or numeric
  name: string;
  email: string;
}

const AnalystsPage: FC = () => {
  const { user } = useAuth();
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [followedAnalysts, setFollowedAnalysts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Admin create form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchAnalysts() {
      try {
        const res = await fetch("/api/analysts", { cache: "no-store" });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          setAnalysts([]);
          if (!res.ok) setError("Failed to load analysts");
        } else {
          // Normalize id to string to handle UUID or numeric ids
          const norm = (data as any[]).map((r) => ({
            id: String(r.id),
            name: r.name ?? r.email,
            email: r.email,
          })) as Analyst[];
          setAnalysts(norm);
        }
      } catch {
        setAnalysts([]);
        setError("Failed to load analysts");
      }
    }
    async function fetchFollowing() {
      try {
        const res = await fetch("/api/me/following", { cache: "no-store" });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          setFollowedAnalysts([]);
        } else {
          const ids = (data as Array<string | number>).map((v) => String(v));
          setFollowedAnalysts(ids);
        }
      } catch {
        setFollowedAnalysts([]);
      }
    }
    (async () => {
      setLoading(true);
      setError("");
      await Promise.all([fetchAnalysts(), fetchFollowing()]);
      setLoading(false);
    })();
  }, []);

  async function handleFollow(id: string) {
    await fetch(`/api/analysts/${id}/follow`, { method: "POST" });
    setFollowedAnalysts([...followedAnalysts, String(id)]);
  }

  async function handleUnfollow(id: string) {
    await fetch(`/api/analysts/${id}/follow`, { method: "DELETE" });
    setFollowedAnalysts(followedAnalysts.filter((i) => i !== String(id)));
  }

  return (
    <div>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Analysts</h1>
        {user?.role === 'admin' && (
          <form
            className="mb-6 p-4 border rounded bg-white max-w-xl"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError("");
              try {
                const res = await fetch('/api/analysts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: newEmail.trim(), password: newPassword }),
                });
                const j = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(j?.error || 'Failed to create analyst');
                } else {
                  setNewEmail("");
                  setNewPassword("");
                  // refresh list
                  setAnalysts((prev) => [{ id: String(j.id), name: j.email, email: j.email }, ...prev]);
                }
              } catch {
                setError('Failed to create analyst');
              } finally {
                setSaving(false);
              }
            }}
          >
            <h2 className="text-lg font-semibold mb-3">Add Analyst (Admin)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 border rounded"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
                >
                  {saving ? 'Creating…' : 'Add Analyst'}
                </button>
              </div>
            </div>
          </form>
        )}
        {loading && <p>Loading…</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(analysts) && analysts.map((analyst) => (
            <div
              key={analyst.id}
              className="bg-white rounded-lg shadow-md p-6 flex justify-between items-center"
            >
              <div>
                <span className="text-lg font-medium">{analyst.name}</span>
                <p className="text-gray-500">{analyst.email}</p>
              </div>
              {user && user.role === 'viewer' && String(user.id) !== String(analyst.id) && (
                followedAnalysts.includes(String(analyst.id)) ? (
                <button
                  onClick={() => handleUnfollow(analyst.id)}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  Unfollow
                </button>
              ) : (
                <button
                  onClick={() => handleFollow(analyst.id)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                >
                  Follow
                </button>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AnalystsPage;
