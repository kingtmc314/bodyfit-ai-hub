import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Home page — redirects immediately to the Dashboard (/dashboard)
 * since BodyFit AI Hub has no login flow.
 */
export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/");
  }, [setLocation]);

  return null;
}
