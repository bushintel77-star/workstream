import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CanvasQueueOp = {
  timestamp: number;
  operation: "add" | "modify" | "delete";
  element: unknown;
};

const cacheKey = (projectId: string) => `canvas-cache-${projectId}`;
const queueKey = (projectId: string) => `canvas-queue-${projectId}`;

export function useOfflineQueue(projectId: string) {
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadCache = useCallback(async () => {
    const raw = await AsyncStorage.getItem(cacheKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  }, [projectId]);

  const saveCache = useCallback(
    async (payload: unknown) => {
      await AsyncStorage.setItem(cacheKey(projectId), JSON.stringify(payload));
    },
    [projectId],
  );

  const enqueue = useCallback(
    async (item: CanvasQueueOp) => {
      const raw = await AsyncStorage.getItem(queueKey(projectId));
      const list: CanvasQueueOp[] = raw ? (JSON.parse(raw) as CanvasQueueOp[]) : [];
      list.push(item);
      await AsyncStorage.setItem(queueKey(projectId), JSON.stringify(list));
      setOffline(true);
    },
    [projectId],
  );

  const flushQueue = useCallback(
    async (flushFn: () => Promise<void>) => {
      setSyncing(true);
      try {
        await flushFn();
        await AsyncStorage.removeItem(queueKey(projectId));
        setOffline(false);
      } finally {
        setSyncing(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    const check = () => setOffline(false);
    check();
  }, []);

  return { offline, syncing, loadCache, saveCache, enqueue, flushQueue };
}
