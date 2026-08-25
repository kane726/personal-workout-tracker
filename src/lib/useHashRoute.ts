import { useEffect, useState } from "react";
import { getRouteFromHash } from "./rules";

export type RouteName = "workout" | "history" | "progress" | "programs" | "settings";

export function useHashRoute() {
  const [route, setRoute] = useState<RouteName>(() => getRouteFromHash(window.location.hash) as RouteName);

  useEffect(() => {
    if (!window.location.hash) window.location.hash = "#/workout";
    const handleHash = () => setRoute(getRouteFromHash(window.location.hash) as RouteName);
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const navigate = (next: RouteName) => {
    window.location.hash = `#/${next}`;
  };

  return { route, navigate };
}
