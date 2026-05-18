import { useMemo } from "react";
import { ConstructClient } from "@construct/client";
import { useAppAuth } from "./auth";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export function useConstructApi(): ConstructClient {
  const { getToken } = useAppAuth();

  return useMemo(
    () =>
      new ConstructClient({
        baseUrl: API_URL,
        getToken: () => getToken(),
      }),
    [getToken],
  );
}

export { API_URL };
