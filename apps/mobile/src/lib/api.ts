import { useAuth } from "@clerk/clerk-expo";
import { useMemo } from "react";
import { WalkthroughClient } from "@walkthrough/client";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export function useWalkthroughApi(): WalkthroughClient {
  const { getToken } = useAuth();

  return useMemo(
    () =>
      new WalkthroughClient({
        baseUrl: API_URL,
        getToken: () => getToken(),
      }),
    [getToken]
  );
}

export { API_URL };
