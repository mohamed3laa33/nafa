"use client";

import { useState, useEffect } from "react";

interface DetailsTabProps {
  stockId: number;
  isOwner: boolean;
}

export default function DetailsTab({ stockId, isOwner }: DetailsTabProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Raw textarea states + validation
  const [techText, setTechText] = useState("");
  const [fundText, setFundText] = useState("");
  const [techErr, setTechErr] = useState<string | null>(null);
  const [fundErr, setFundErr] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${stockId}/details`);
        if (res.ok) {
          const data = await res.json();
          setDetails(data || {});
          setTechText(
            data?.technical_json ? JSON.stringify(data.technical_json, null, 2) : ""
          );
            setFundText(
            data?.fundamental_json ? JSON.stringify(data.fundamental_json, null, 2) : ""
          );
        } else if (res.status === 404) {
          setDetails({});
          setTechText("");
          setFundText("");
        } else {
          setError("Failed to fetch details");
        }
      } catch {
        setError("An unexpected error occurred.");
      }
      setLoading(false);
    }
    fetchDetails();
  }, [stockId]);

  const handleTechChange = (v: string) => {
    setTechText(v);
    try {
      const parsed = v.trim() === "" ? null : JSON.parse(v);
      setDetails((d: any) => ({ ...(d || {}), technical_json: parsed }));
      setTechErr(null);
    } catch {
      setTechErr("Invalid JSON");
    }
  };

  const handleFundChange = (v: string) => {
    setFundText(v);
    try {
      const parsed = v.trim() === "" ? null : JSON.parse(v);
      setDetails((d: any) => ({ ...(d || {}), fundamental_json: parsed }));
      setFundErr(null);
    } catch {
      setFundErr("Invalid JSON");
    }
  };

  const handleSave = async () => {
    if (techErr || fundErr) {
      setError("Fix JSON errors before saving.");
      return;
    }
    try {
      const res = await fetch(`/api/stocks/${stockId}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details || {}),
      });
      if (!res.ok) setError("Failed to save details");
    } catch {
      setError("An unexpected error occurred.");
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Details</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-bold">Technical</h3>
          <textarea
            className="w-full h-64 p-2 border rounded"
            value={techText}
            onChange={(e) => handleTechChange(e.target.value)}
            disabled={!isOwner}
          />
          {techErr && <p className="text-red-500 text-sm mt-1">{techErr}</p>}
        </div>

        <div>
          <h3 className="font-bold">Fundamental</h3>
          <textarea
            className="w-full h-64 p-2 border rounded"
            value={fundText}
            onChange={(e) => handleFundChange(e.target.value)}
            disabled={!isOwner}
          />
          {fundErr && <p className="text-red-500 text-sm mt-1">{fundErr}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-bold">Sentiment</h3>
          <select
            value={details?.sentiment ?? ""}
            onChange={(e) =>
              setDetails({ ...(details || {}), sentiment: e.target.value })
            }
            disabled={!isOwner}
            className="p-2 border rounded w-full"
          >
            <option value="">Select Sentiment</option>
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        <div>
          <h3 className="font-bold">Score (0-100)</h3>
          <input
            type="number"
            min="0"
            max="100"
            value={details?.score_total ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              setDetails({ ...(details || {}), score_total: n });
            }}
            disabled={!isOwner}
            className="p-2 border rounded w-full"
          />
        </div>
      </div>

      {isOwner && (
        <button
          onClick={handleSave}
          disabled={!!techErr || !!fundErr}
          className="mt-4 bg-blue-500 text-white py-2 px-4 rounded disabled:opacity-60"
        >
          Save Details
        </button>
      )}
    </div>
  );
}
