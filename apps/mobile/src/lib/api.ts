import { useMemo } from "react";
import { WalkthroughClient } from "@walkthrough/client";
import { useAppAuth } from "./auth";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export function useWalkthroughApi(): WalkthroughClient {
  const { getToken } = useAppAuth();

  return useMemo(
    () =>
      new WalkthroughClient({
        baseUrl: API_URL,
        getToken: () => getToken(),
      }),
    [getToken],
  );
}

export { API_URL };
