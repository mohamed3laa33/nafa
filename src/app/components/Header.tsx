"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/app/AuthContext";
import { useEffect, useRef, useState } from "react";

export default function Header() {
  const { user, logout, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current || !btnRef.current) return;
      if (
        !menuRef.current.contains(e.target as Node) &&
        !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="header-brand p-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <Link href={user ? "/calls" : "/"} className="font-bold">
          <div className="bg-white p-1 rounded-md">
            <Image src="/logo.png" alt="Nafaa Logo" width={100} height={40} />
          </div>
        </Link>
        <Link href={user ? "/calls" : "/"} className="font-bold">Dashboard</Link>
        <Link href="/calls">Open Calls</Link>
        <Link href="/scans">Scans</Link>
        <Link href="/all-closed-calls">Closed Calls</Link>
        <Link href="/stocks">Stocks</Link>
        <Link href="/analysts">Analysts</Link>
      </div>

      <div className="flex items-center gap-4">
        {!isLoading && user && (
          <>
            <div className="relative">
              <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                className="text-sm outline-none focus:ring-2 focus:ring-white/40 rounded px-1"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <span className="font-bold">{user.email}</span>{" "}
                <span className="opacity-80">({user.role})</span>
              </button>
              {open && (
                <div
                  ref={menuRef}
                  role="menu"
                  className="absolute right-0 mt-2 w-52 rounded-md bg-white text-gray-800 shadow-lg ring-1 ring-black/10 overflow-hidden z-50"
                >
                  <Link
                    href="/update-password"
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    Update password
                  </Link>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
