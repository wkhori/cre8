"use client";

import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase-client";

const PROFILE_COLLECTION = "profiles";

export interface UserProfile {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
}

function fallbackName(email: string | null): string {
  if (!email) return "Creator";
  const localPart = email.split("@")[0] ?? "";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Creator";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export async function loadOrCreateUserProfile(user: User): Promise<UserProfile> {
  const profileRef = doc(firebaseDb, PROFILE_COLLECTION, user.uid);
  const snapshot = await getDoc(profileRef);
  const data = snapshot.data() as { name?: string; email?: string; photoURL?: string } | undefined;

  const name =
    user.displayName?.trim() ||
    data?.name?.trim() ||
    fallbackName(user.email ?? data?.email ?? null);

  const profilePatch = {
    uid: user.uid,
    name,
    email: user.email ?? data?.email ?? null,
    photoURL: user.photoURL ?? data?.photoURL ?? null,
    providerIds: user.providerData.map((provider) => provider.providerId),
    updatedAt: serverTimestamp(),
  };

  if (snapshot.exists()) {
    await setDoc(profileRef, profilePatch, { merge: true });
  } else {
    await setDoc(
      profileRef,
      {
        ...profilePatch,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    uid: user.uid,
    name,
    email: user.email ?? data?.email ?? null,
    photoURL: user.photoURL ?? data?.photoURL ?? null,
  };
}
