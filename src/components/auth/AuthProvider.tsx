"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
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
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}

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

  const signUpWithEmail = useCallback(async (name: string, email: string, password: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await updateProfile(credential.user, { displayName: name });
      // Force onAuthStateChanged to pick up the new displayName
      await credential.user.reload();
    } catch (err) {
      console.error("Email sign-up failed", err);
      setError(friendlyAuthError(err));
    } finally {
      setActionLoading(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (err) {
      console.error("Email sign-in failed", err);
      setError(friendlyAuthError(err));
    } finally {
      setActionLoading(false);
    }
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
      signUpWithEmail,
      signInWithEmail,
      signOut,
    }),
    [actionLoading, error, loading, profile, signInWithGoogle, signUpWithEmail, signInWithEmail, signOut, user]
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

