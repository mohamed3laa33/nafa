
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

    const publicRoutes = new Set(["/", "/login", "/signup"]);
    const isPublic = publicRoutes.has(pathname);

    if (!user && !isPublic) {
      router.push("/login");
      return;
    }

    if (user) {
      if (pathname === "/login" || pathname === "/signup" || pathname === "/") {
        router.push("/calls");
      }
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return <div>Loading...</div>; // Or a proper skeleton loader
  }

  const isAuthPage = pathname === "/login";
  const isPublicLanding = pathname === "/";

  return (
    <>
      {!isAuthPage && !isPublicLanding && <Header />}
      {children}
    </>
  );
}
