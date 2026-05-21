import { useAuth as useClerkAuth } from "@clerk/clerk-expo";

/**
 * Production builds and EXPO_PUBLIC_AUTH_REQUIRED require Clerk. Local dev
 * without keys still uses dev-user (matches API when AUTH_REQUIRED is unset).
 */
export const isAuthRequired =
  !__DEV__ || process.env.EXPO_PUBLIC_AUTH_REQUIRED === "true";

export const isAuthEnabled = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const isAuthMisconfigured = isAuthRequired && !isAuthEnabled;

type AuthShape = {
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

function useDevAuth(): AuthShape {
  return {
    isLoaded: true,
    isSignedIn: true,
    signOut: async () => {
      /* no-op in dev mode */
    },
    getToken: async () => null,
  };
}

function useClerkAuthCompat(): AuthShape {
  const auth = useClerkAuth();
  return {
    isLoaded: auth.isLoaded,
    isSignedIn: !!auth.isSignedIn,
    signOut: async () => {
      await auth.signOut();
    },
    getToken: () => auth.getToken(),
  };
}

export const useAppAuth: () => AuthShape = isAuthEnabled
  ? useClerkAuthCompat
  : useDevAuth;
