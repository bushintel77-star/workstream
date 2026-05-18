import { useAuth as useClerkAuth } from "@clerk/clerk-expo";

/**
 * True when the app is configured with a Clerk publishable key. When false,
 * the app runs in dev mode with a permanent "dev-user" signed in — matches
 * the API's CLERK_SECRET_KEY-absent fallback so the full flow works without
 * provisioning Clerk for a demo.
 */
export const isAuthEnabled = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
