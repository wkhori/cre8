"use client";

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  firebaseAuth,
  googleAuthProvider,
} from "@/lib/firebase-client";
import {
  loadOrCreateUserProfile,
  type UserProfile,
} from "@/lib/user-profile";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function makeFallbackProfile(user: User): UserProfile {
  const defaultName =
    user.displayName?.trim() ||
    user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim() ||
    "Creator";

  return {
    uid: user.uid,
    name: defaultName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setLoading(true);
      setError(null);
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await loadOrCreateUserProfile(nextUser);
        setProfile(nextProfile);
      } catch (err) {
        console.error("Failed to load/create Firebase profile", err);
        setProfile(makeFallbackProfile(nextUser));
        setError("Signed in, but profile sync failed. Check Firestore setup/rules.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      await signInWithPopup(firebaseAuth, googleAuthProvider);
    } catch (err) {
      console.error("Google sign-in failed", err);
      setError("Could not sign in with Google. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      await firebaseSignOut(firebaseAuth);
    } catch (err) {
      console.error("Sign out failed", err);
      setError("Could not sign out. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      actionLoading,
      error,
      signInWithGoogle,
      signOut,
    }),
    [actionLoading, error, loading, profile, signInWithGoogle, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return context;
}

