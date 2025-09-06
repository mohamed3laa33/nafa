"use client";

import { useEffect, useRef, useState } from "react";

export default function Visible({ children, rootMargin = "200px", placeholder = "—", className = "" }: { children: React.ReactNode; rootMargin?: string; placeholder?: React.ReactNode; className?: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || show) return;
    const node = ref.current;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setShow(true); io.disconnect(); break; }
      }
    }, { root: null, rootMargin, threshold: 0.01 });
    io.observe(node);
    return () => io.disconnect();
  }, [show, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {show ? children : placeholder}
    </div>
  );
}

