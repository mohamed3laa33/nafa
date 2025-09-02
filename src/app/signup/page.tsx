"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<'viewer' | 'analyst'>('viewer');

  // Preselect role from query (?role=analyst)
  // Client component: safe to access window.location
  // Use effect to avoid setting state during render
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const r = (url.searchParams.get('role') || '').toLowerCase();
      if (r === 'analyst') setRole('analyst');
    } catch {}
  }, []);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Signup failed");
      router.push("/calls");
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm p-6 border rounded-lg shadow-sm bg-white">
        <h1 className="text-xl font-bold mb-4">Create a free viewer account</h1>
        {error && <p className="text-red-600 mb-3 text-sm">{error}</p>}
        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          className="w-full p-2 border rounded mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          className="w-full p-2 border rounded mb-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <label className="block text-sm mb-1">Role</label>
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="role" value="viewer" checked={role==='viewer'} onChange={()=>setRole('viewer')} />
            Viewer
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="role" value="analyst" checked={role==='analyst'} onChange={()=>setRole('analyst')} />
            Analyst
          </label>
        </div>
        <label className="block text-sm mb-1">Confirm Password</label>
        <input
          type="password"
          className="w-full p-2 border rounded mb-4"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-60"
        >
          {loading ? "Signing up…" : `Sign up (${role})`}
        </button>
      </form>
    </div>
  );
}
