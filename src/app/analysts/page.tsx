
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
