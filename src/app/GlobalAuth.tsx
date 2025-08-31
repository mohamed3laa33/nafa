
"use client";

import { useAuth } from "./AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

import Header from "./components/Header";

export default function GlobalAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const isAuthPage = pathname === "/login";

    if (!user && !isAuthPage) {
      router.push("/login");
    }

    if (user && isAuthPage) {
      router.push("/");
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return <div>Loading...</div>; // Or a proper skeleton loader
  }

  const isAuthPage = pathname === "/login";

  return (
    <>
      {!isAuthPage && <Header />}
      {children}
    </>
  );
}
