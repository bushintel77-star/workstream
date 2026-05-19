import { useMemo } from "react";
import { WorkstreamClient } from "@workstream/client";
import { useAppAuth } from "./auth";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export function useWorkstreamApi(): WorkstreamClient {
  const { getToken } = useAppAuth();

  return useMemo(
    () =>
      new WorkstreamClient({
        baseUrl: API_URL,
        getToken: () => getToken(),
      }),
    [getToken],
  );
}

export { API_URL };
