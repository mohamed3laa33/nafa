"use client";

import { useState, useEffect, useCallback } from "react";
import useCancellableFetch from "@/lib/useCancellableFetch";

interface Reference {
  id: string;          // UUID
  url: string;         // API returns `url`
  title?: string | null;
  note?: string | null;
  created_at?: string;
}

interface ReferencesTabProps {
  stockId: string;     // UUID string
  isOwner: boolean;
}

export default function ReferencesTab({ stockId, isOwner }: ReferencesTabProps) {
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLink, setNewLink] = useState("");
  const fetchWithCancel = useCancellableFetch();

  const fetchReferences = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithCancel(`/api/stocks/${stockId}/refs`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to fetch references");
        setReferences([]);
        setLoading(false);
        return;
      }
      const json = await res.json();
      const data = Array.isArray(json?.data) ? (json.data as Reference[]) : [];
      setReferences(data);
    } catch (_err) {
      setError("An unexpected error occurred while loading references.");
      setReferences([]);
    } finally {
      setLoading(false);
    }
  }, [stockId, fetchWithCancel]);

  useEffect(() => {
    if (stockId) fetchReferences();
  }, [stockId, fetchReferences]);

  const deriveTitle = (urlStr: string) => {
    try {
      const u = new URL(urlStr);
      return u.hostname;
    } catch {
      return urlStr;
    }
  };

  const handleAdd = async () => {
    setError("");
    const url = newLink.trim();
    if (!url) return;

    try {
      const res = await fetchWithCancel(`/api/stocks/${stockId}/refs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // API expects { title, url, note? }
        body: JSON.stringify({ title: deriveTitle(url), url }),
      });
      if (!res.ok) {
        setError("Failed to add reference");
        return;
      }
      // Back-end returns { id }, so re-fetch to get the full row
      await fetchReferences();
      setNewLink("");
    } catch (_err) {
      setError("An unexpected error occurred while adding the reference.");
    }
  };

  const handleRemove = async (refId: string) => {
    if (!confirm("Are you sure you want to delete this reference?")) return;

    setError("");
    try {
      const res = await fetchWithCancel(`/api/refs/${refId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete reference");
        return;
      }
      // Optimistic update (or re-fetch)
      setReferences((prev) => prev.filter((ref) => ref.id !== refId));
      // Alternatively: await fetchReferences();
    } catch (_err) {
      setError("An unexpected error occurred while deleting the reference.");
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">References</h2>

      {isOwner && (
        <div className="flex gap-2 mb-4">
          <input
            type="url"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleAdd}
            className="btn-brand py-2 px-4 rounded"
          >
            Add
          </button>
        </div>
      )}

      <ul>
        {Array.isArray(references) &&
          references.map((ref) => (
            <li key={ref.id} className="flex justify-between items-center mb-2">
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 truncate max-w-[75%]"
                title={ref.title || ref.url}
              >
                {ref.title || ref.url}
              </a>
              {isOwner && (
                <button
                  onClick={() => handleRemove(ref.id)}
                  className="text-red-500"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
