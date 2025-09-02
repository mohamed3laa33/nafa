
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
  const [newUsername, setNewUsername] = useState("");
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
            className="mb-6 p-4 card-brand rounded max-w-xl"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError("");
              try {
                const res = await fetch('/api/analysts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username: newUsername.trim(), email: newEmail.trim(), password: newPassword }),
                });
                const j = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(j?.error || 'Failed to create analyst');
                } else {
                  setNewUsername("");
                  setNewEmail("");
                  setNewPassword("");
                  // refresh list
                  setAnalysts((prev) => [{ id: String(j.id), name: j.username || j.email, email: j.email }, ...prev]);
                }
              } catch {
                setError('Failed to create analyst');
              } finally {
                setSaving(false);
              }
            }}
          >
            <h2 className="text-lg font-semibold mb-3">Add Analyst (Admin)</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-sm mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full input-brand"
                  minLength={3}
                  maxLength={32}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full input-brand"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full input-brand"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-brand px-4 py-2 disabled:opacity-60"
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
            <div key={analyst.id} className="card-brand rounded-lg p-6 flex justify-between items-center">
              <div>
                <span className="text-lg font-medium">{analyst.name}</span>
                <p className="text-gray-500">{analyst.email}</p>
              </div>
              {user && user.role === 'viewer' && String(user.id) !== String(analyst.id) && (
                followedAnalysts.includes(String(analyst.id)) ? (
                <button
                  onClick={() => handleUnfollow(analyst.id)}
                  className="btn-brand opacity-80 hover:opacity-100 font-bold py-2 px-4"
                >
                  Unfollow
                </button>
              ) : (
                <button
                  onClick={() => handleFollow(analyst.id)}
                  className="btn-brand font-bold py-2 px-4"
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
