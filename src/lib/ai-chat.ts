"use client";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
  type FieldValue,
} from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase-client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Timestamp | FieldValue | null;
  operationCount?: number;
}

/**
 * Subscribe to chat messages for a specific user on a specific board.
 * Path: boards/{boardId}/ai-chats/{uid}/messages/{messageId}
 * Each user has independent chat history on shared boards.
 */
export function subscribeChatMessages(
  boardId: string,
  uid: string,
  onMessages: (msgs: ChatMessage[]) => void
): () => void {
  const messagesRef = collection(firebaseDb, "boards", boardId, "ai-chats", uid, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  return onSnapshot(q, (snapshot) => {
    const msgs: ChatMessage[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatMessage[];
    onMessages(msgs);
  });
}

/**
 * Add a chat message to the user's chat history for a board.
 */
export async function addChatMessage(
  boardId: string,
  uid: string,
  message: Omit<ChatMessage, "id">
): Promise<string> {
  const messagesRef = collection(firebaseDb, "boards", boardId, "ai-chats", uid, "messages");
  const docRef = await addDoc(messagesRef, {
    ...message,
    timestamp: serverTimestamp(),
  });
  return docRef.id;
}
