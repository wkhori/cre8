# CollabBoard — Product Requirements Document

## Project Overview

CollabBoard is a real-time collaborative whiteboard application with an AI agent that manipulates the board through natural language. Users can create, move, and edit sticky notes, shapes, frames, and connectors on an infinite canvas while seeing each other's cursors and changes in real time.

**Gate:** Project completion is required for Austin admission.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router) + TypeScript |
| Canvas | Konva.js via `react-konva` |
| Real-time (high-freq) | Firebase Realtime Database (cursors, presence) |
| Real-time (structured) | Cloud Firestore (board objects, metadata) |
| Auth | Firebase Auth (Google sign-in + email/password) |
| AI Agent | Anthropic Claude Sonnet 4 with tool use |
| AI Endpoint | Next.js API Route (`/api/ai-command`) |
| Deployment | Vercel |
| Testing | Vitest (unit) + Playwright (e2e) |
| Styling | Tailwind CSS |

---

## Project Structure

```
collabboard/
├── app/
│   ├── page.tsx                     # Landing / auth page
│   ├── layout.tsx                   # Root layout
│   ├── board/[id]/
│   │   └── page.tsx                 # Board workspace (use client)
│   └── api/
│       └── ai-command/
│           └── route.ts             # AI agent endpoint (server-side)
├── components/
│   ├── canvas/
│   │   ├── Board.tsx                # Main infinite canvas (Stage + Layer)
│   │   ├── StickyNote.tsx           # Sticky note component
│   │   ├── Shape.tsx                # Rectangle, circle, line
│   │   ├── Connector.tsx            # Lines/arrows between objects
│   │   ├── Frame.tsx                # Grouping frames
│   │   ├── TextElement.tsx          # Standalone text
│   │   ├── CursorsLayer.tsx         # Multiplayer cursors overlay
│   │   ├── SelectionBox.tsx         # Drag-to-select rectangle
│   │   └── TransformHandler.tsx     # Resize/rotate controls
│   ├── toolbar/
│   │   ├── Toolbar.tsx              # Main tools panel
│   │   └── ColorPicker.tsx          # Color selection
│   ├── presence/
│   │   └── PresenceBar.tsx          # Who's online indicator
│   ├── ai/
│   │   └── AICommandInput.tsx       # Natural language input UI
│   └── auth/
│       └── AuthGate.tsx             # Auth wrapper component
├── lib/
│   ├── firebase.ts                  # Firebase app init + exports
│   ├── board-operations.ts          # SHARED create/move/edit/delete functions
│   ├── sync.ts                      # Firestore real-time listeners
│   ├── presence.ts                  # RTDB presence + cursor sync
│   ├── ai-tools.ts                  # Claude tool schemas + execution
│   └── utils.ts                     # ID generation, color constants, helpers
├── hooks/
│   ├── useBoard.ts                  # Board object state + Firestore sync
│   ├── useCursors.ts                # Cursor positions via RTDB
│   ├── usePresence.ts               # Online users via RTDB
│   ├── useCanvas.ts                 # Pan/zoom/selection state
│   └── useAIAgent.ts                # AI command submission + loading state
├── types/
│   └── board.ts                     # All TypeScript interfaces
├── __tests__/
│   ├── unit/
│   │   ├── board-operations.test.ts
│   │   └── ai-tools.test.ts
│   └── e2e/
│       ├── sync.spec.ts
│       └── ai-commands.spec.ts
├── .env.local                       # Firebase + Anthropic keys
├── firebase.json                    # Firebase config (if using emulators)
└── vercel.json                      # Vercel config (if needed)
```

---

## Key Architecture Pattern: Shared Board Operations

Both the frontend UI and the AI agent call the same functions in `lib/board-operations.ts`. This is the single most important architectural decision — it guarantees that human-created and AI-created objects follow identical code paths for validation, sync, and conflict handling.

```
Human interaction (Konva event) ──→ board-operations.ts ──→ Firebase
AI agent (tool use result)      ──→ board-operations.ts ──→ Firebase
Firebase listener               ──→ React state          ──→ Konva re-render
```

---

## TypeScript Interfaces

Define these in `types/board.ts`. All board objects share a base interface.

```typescript
interface BoardObject {
  id: string;
  type: 'sticky' | 'shape' | 'text' | 'frame' | 'connector';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  createdBy: string;       // user UID
  createdAt: number;       // timestamp
  updatedAt: number;       // timestamp
}

interface StickyNote extends BoardObject {
  type: 'sticky';
  text: string;
  color: string;           // hex color
}

interface ShapeObject extends BoardObject {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'line';
  fill: string;
  stroke: string;
  strokeWidth: number;
  // Lines use x,y as start point; width,height as end point offset
}

interface TextObject extends BoardObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
}

interface FrameObject extends BoardObject {
  type: 'frame';
  title: string;
  fill: string;            // background color (semi-transparent)
  stroke: string;
}

interface ConnectorObject extends BoardObject {
  type: 'connector';
  fromId: string;          // source object ID
  toId: string;            // target object ID
  style: 'line' | 'arrow';
  stroke: string;
  strokeWidth: number;
}

interface CursorPosition {
  uid: string;
  displayName: string;
  color: string;           // assigned cursor color
  x: number;
  y: number;
  lastUpdated: number;
}

interface PresenceUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  color: string;
  online: boolean;
  lastSeen: number;
}

interface Board {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}
```

---

## Firebase Data Structure

### Realtime Database (high-frequency data)

```
/boards/{boardId}/cursors/{uid} = {
  displayName: string,
  color: string,
  x: number,
  y: number,
  lastUpdated: number
}

/boards/{boardId}/presence/{uid} = {
  displayName: string,
  photoURL: string | null,
  color: string,
  online: boolean,
  lastSeen: number
}
```

### Firestore (structured data)

```
boards/{boardId} = {
  name: string,
  ownerId: string,
  createdAt: timestamp,
  updatedAt: timestamp
}

boards/{boardId}/objects/{objectId} = {
  // Any BoardObject (StickyNote | ShapeObject | TextObject | FrameObject | ConnectorObject)
}
```

---

## Performance Targets

| Metric | Target | How to Validate |
|---|---|---|
| Frame rate | 60 FPS during pan, zoom, manipulation | Chrome DevTools Performance tab |
| Object sync latency | <100ms | Firestore onSnapshot listener timing |
| Cursor sync latency | <50ms | RTDB onValue listener timing |
| Object capacity | 500+ objects without drops | Programmatically create 500 sticky notes, measure FPS |
| Concurrent users | 5+ without degradation | Open 5+ browser tabs, test sync |
| AI response latency | <2s for single-step commands | Measure round-trip from command submit to objects appearing |

---

## Evaluator Test Scenarios

These are the exact scenarios evaluators will run. Test against all of them before submission.

1. **Two users editing simultaneously** — Open in two different browsers (e.g., Chrome + Firefox, or two Chrome profiles). Both create/move objects. Changes appear instantly for both.
2. **Refresh mid-edit** — One user creates objects, refreshes the page. All objects persist and reappear.
3. **Rapid creation and movement** — Quickly create 10+ sticky notes and drag them around. Sync should keep up without lag or missing objects.
4. **Network throttling** — In Chrome DevTools > Network, throttle to "Slow 3G". Verify graceful degradation — objects should eventually sync, cursors may lag but should recover. Disconnect WiFi entirely, reconnect — state should recover without data loss.
5. **5+ concurrent users** — Open 5+ tabs/browsers. All see each other's cursors. All can create/edit simultaneously.

---

# PHASE 1 — MVP (24 Hours)

Everything in Phase 1 is a hard gate requirement. All items must pass.

## MVP Checklist

- [ ] Infinite board with pan/zoom
- [ ] Sticky notes with editable text
- [ ] At least one shape type (rectangle)
- [ ] Create, move, and edit objects
- [ ] Real-time sync between 2+ users
- [ ] Multiplayer cursors with name labels
- [ ] Presence awareness (who's online)
- [ ] User authentication
- [ ] Deployed and publicly accessible

---

### Task 1.1: Project Scaffolding

**Goal:** Working Next.js app with Firebase initialized, deployed to Vercel.

**Steps:**
1. Create Next.js app: `npx create-next-app@latest collabboard --typescript --tailwind --app --eslint`
2. Install dependencies:
   ```
   npm install firebase react-konva konva
   npm install -D vitest @testing-library/react playwright
   ```
3. Create Firebase project in console.firebase.google.com:
   - Enable Authentication (Google + Email/Password providers)
   - Create Firestore database (start in test mode, lock down later)
   - Create Realtime Database (start in test mode, lock down later)
4. Create `.env.local` with Firebase config + Anthropic API key:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=
   ANTHROPIC_API_KEY=
   ```
5. Create `lib/firebase.ts` — initialize Firebase app, export `auth`, `db` (Firestore), `rtdb` (Realtime DB)
6. Deploy to Vercel, connect GitHub repo, add env vars to Vercel dashboard
7. Verify deployed site loads

**Validation:** Deployed app loads at Vercel URL. Firebase initialized without errors in console.

---

### Task 1.2: Authentication

**Goal:** Users can sign in. Authenticated users see the board. Unauthenticated users see a login screen.

**Steps:**
1. Create `components/auth/AuthGate.tsx`:
   - Google sign-in button
   - Email/password sign-in form (simple)
   - Uses `signInWithPopup` for Google, `signInWithEmailAndPassword` / `createUserWithEmailAndPassword` for email
2. Create `hooks/useAuth.ts`:
   - Wraps `onAuthStateChanged`
   - Returns `{ user, loading, signIn, signOut }`
3. Landing page (`app/page.tsx`):
   - If authenticated → redirect to `/board/{defaultBoardId}` or show board list
   - If not authenticated → show AuthGate
4. Board page (`app/board/[id]/page.tsx`):
   - Wrap in auth check, redirect to `/` if not signed in

**Validation:** Sign in with Google. See user display name. Sign out. Sign in with different account. Both accounts have unique UIDs.

---

### Task 1.3: Infinite Canvas with Pan/Zoom

**Goal:** Empty infinite canvas that supports smooth pan and zoom.

**Steps:**
1. Create `components/canvas/Board.tsx`:
   - Konva `Stage` component with `draggable` for panning
   - Track `stagePos` (x, y) and `stageScale` for zoom
   - Mouse wheel handler for zoom (scale toward cursor position)
   - Minimum scale: 0.1, maximum scale: 5
2. The Stage should fill the viewport (`window.innerWidth`, `window.innerHeight`)
3. Handle window resize events to update Stage dimensions

**Implementation notes:**
- Pan: Set `Stage` `draggable={true}`, update position on `onDragEnd`
- Zoom: On `wheel` event, calculate new scale and adjust position to zoom toward mouse pointer
- Use `React.useState` or `useReducer` for canvas transform state

```typescript
// Zoom toward pointer formula
const scaleBy = 1.05;
const stage = stageRef.current;
const oldScale = stage.scaleX();
const pointer = stage.getPointerPosition();
const mousePointTo = {
  x: (pointer.x - stage.x()) / oldScale,
  y: (pointer.y - stage.y()) / oldScale,
};
const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
const newPos = {
  x: pointer.x - mousePointTo.x * newScale,
  y: pointer.y - mousePointTo.y * newScale,
};
```

**Validation:** Canvas pans smoothly when dragging empty space. Scroll wheel zooms in/out toward cursor. 60 FPS maintained.

---

### Task 1.4: Presence System (RTDB)

**Goal:** Each user's online status is tracked. When they close the tab, they go offline.

**Steps:**
1. Create `lib/presence.ts`:
   - On auth, write user info to `/boards/{boardId}/presence/{uid}`
   - Use `onDisconnect().update({ online: false, lastSeen: serverTimestamp })` to auto-mark offline
   - Set `online: true` on connection
2. Create `hooks/usePresence.ts`:
   - Listen to `/boards/{boardId}/presence/` with `onValue`
   - Return array of `PresenceUser` objects
   - Filter to online users for display
3. Create `components/presence/PresenceBar.tsx`:
   - Show avatars/initials of online users
   - Show count of online users
   - Assign each user a consistent color (used for cursor + avatar)

**Color assignment:** Use a fixed palette of 8-10 distinct colors. Assign based on index of user joining order, or hash of UID.

**Validation:** Open in two browsers with different accounts. Both appear in presence bar. Close one tab — that user disappears from presence within 10 seconds.

---

### Task 1.5: Multiplayer Cursors (RTDB)

**Goal:** Every user sees every other user's cursor moving in real time with their name label.

**Steps:**
1. In `lib/presence.ts`, add cursor broadcast function:
   - On mouse move over Stage, write `{ x, y, lastUpdated }` to `/boards/{boardId}/cursors/{uid}`
   - **Throttle to 20-30Hz** — do NOT write on every mousemove event. Use `requestAnimationFrame` or a throttle utility (16-33ms intervals)
   - Cursor x/y should be in board coordinates (account for pan/zoom transform)
2. Create `hooks/useCursors.ts`:
   - Listen to `/boards/{boardId}/cursors/` with `onValue`
   - Return map of `{ [uid]: CursorPosition }`
   - Filter out own cursor
3. Create `components/canvas/CursorsLayer.tsx`:
   - Render on a separate Konva `Layer` on top of the board objects layer
   - For each remote cursor: render a pointer arrow shape + name label
   - Use the user's assigned color for the cursor
   - Smooth cursor movement with interpolation (lerp between positions) for visual smoothness

**Critical:** Convert between screen coordinates and board coordinates correctly. When a user pans/zooms, remote cursor positions (which are in board coordinates) must still render in the correct screen position.

**Validation:** Open two browsers side by side. Move mouse in one — cursor appears and moves smoothly in the other within 50ms. Name label displays correctly.

---

### Task 1.6: Board Operations (Shared Library)

**Goal:** Core CRUD functions that both the UI and AI agent will use.

**Steps:**
1. Create `lib/board-operations.ts` with these functions:

```typescript
// All functions write to Firestore: boards/{boardId}/objects/{objectId}

createStickyNote(boardId: string, params: {
  text: string;
  x: number;
  y: number;
  color?: string;        // default: '#fef08a' (yellow)
  width?: number;         // default: 200
  height?: number;        // default: 200
  createdBy: string;
}): Promise<string>       // returns objectId

createShape(boardId: string, params: {
  shapeType: 'rectangle' | 'circle' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  createdBy: string;
}): Promise<string>

moveObject(boardId: string, objectId: string, x: number, y: number): Promise<void>

resizeObject(boardId: string, objectId: string, width: number, height: number): Promise<void>

updateText(boardId: string, objectId: string, newText: string): Promise<void>

changeColor(boardId: string, objectId: string, color: string): Promise<void>

deleteObject(boardId: string, objectId: string): Promise<void>

duplicateObject(boardId: string, objectId: string, offsetX?: number, offsetY?: number): Promise<string>

getBoardState(boardId: string): Promise<BoardObject[]>
```

2. Each function:
   - Generates a unique ID (use `crypto.randomUUID()` or Firestore auto-ID)
   - Writes to Firestore `boards/{boardId}/objects/{objectId}`
   - Sets `updatedAt: Date.now()` on every write
   - Validates inputs (coordinates are numbers, colors are valid hex, etc.)

**Validation:** Unit test each function. Call `createStickyNote`, verify document exists in Firestore. Call `moveObject`, verify coordinates updated.

---

### Task 1.7: Real-Time Sync (Firestore Listeners)

**Goal:** When any user creates/edits/deletes an object, all other users see it instantly.

**Steps:**
1. Create `lib/sync.ts`:
   - Subscribe to `boards/{boardId}/objects` collection with `onSnapshot`
   - On snapshot change, diff against local state and update
   - Handle `added`, `modified`, `removed` document changes
2. Create `hooks/useBoard.ts`:
   - Initialize Firestore listener on mount
   - Maintain `Map<string, BoardObject>` in state
   - Return `{ objects, loading, error }`
   - Clean up listener on unmount

**Conflict resolution approach:** Last-write-wins. Every write sets `updatedAt: Date.now()`. No merge logic needed — Firestore's `onSnapshot` delivers the latest state. This is acceptable per the requirements ("last-write-wins acceptable, document your approach").

**Optimistic updates:** When the local user creates/moves an object, update local state immediately (don't wait for Firestore round-trip). The Firestore listener will confirm or correct. This keeps the UI feeling instant.

**Validation:** Open two browsers. Create a sticky note in browser A. It appears in browser B within 100ms. Move it in A — it moves in B. Delete in B — it disappears in A.

---

### Task 1.8: Sticky Notes

**Goal:** Users can create sticky notes, edit their text, move them, and change their color.

**Steps:**
1. Create `components/canvas/StickyNote.tsx`:
   - Konva `Group` containing a `Rect` (background) + `Text` (content)
   - `draggable={true}`
   - On `onDragEnd`, call `moveObject()` with new position
   - On double-click, show HTML `<textarea>` overlay for text editing
   - On textarea blur or Enter, call `updateText()` and hide textarea
   - Default size: 200×200
   - Default color: yellow (#fef08a)
   - Show truncated text if it overflows the note area
2. Text editing overlay:
   - Position an absolute-positioned `<textarea>` element over the Konva note
   - Match the position, size, font, and scale to the Konva text
   - Account for the current pan/zoom transform when positioning
3. Toolbar integration:
   - "Add Sticky Note" button in toolbar
   - Click creates a note at the center of the current viewport
   - Color picker to change selected note's color

**Validation:** Create a sticky note. Double-click to edit text. Type "Hello World". Click away. Text persists. Drag to new position. Refresh page — note is still there with correct text and position.

---

### Task 1.9: Shapes (Rectangle — MVP minimum)

**Goal:** Users can create at least one shape type, move and resize it.

**Steps:**
1. Create `components/canvas/Shape.tsx`:
   - For rectangle: Konva `Rect` with fill and stroke
   - For circle: Konva `Circle`
   - For line: Konva `Line`
   - All draggable, all call `moveObject()` on `onDragEnd`
2. Toolbar button for each shape type
3. On creation, place at viewport center with default dimensions (150×100 for rect, radius 50 for circle)
4. Shape selection shows a Konva `Transformer` for resize/rotate (Task 1.10)

**MVP minimum:** Rectangle only. Circle and line are post-MVP but should be trivial to add given the Shape component structure.

**Validation:** Create a rectangle. Move it. See it sync to another browser. Resize it (if Transformer is ready).

---

### Task 1.10: Selection and Transforms

**Goal:** Users can select objects and resize/rotate them.

**Steps:**
1. Single select: Click an object to select it. Show Konva `Transformer` around it.
2. Click empty canvas to deselect.
3. `TransformHandler.tsx`:
   - Wraps selected object with `Transformer` component
   - On `onTransformEnd`, read new width/height/rotation from the node
   - Call `resizeObject()` and update rotation in Firestore
4. Multi-select (shift-click and drag-to-select) is post-MVP but design the selection state to support it:
   - `selectedIds: Set<string>` in canvas state

**Validation:** Click a sticky note — transformer handles appear. Drag a corner to resize. See the change sync to another browser.

---

### Task 1.11: Toolbar

**Goal:** UI for creating objects and selecting tools.

**Steps:**
1. Create `components/toolbar/Toolbar.tsx`:
   - Tools: Select (pointer), Sticky Note, Rectangle, (future: Circle, Line, Frame, Connector, Text)
   - Active tool state
   - When a creation tool is active, clicking on canvas creates that object at click position
2. Minimal but functional — vertical bar on the left side or horizontal bar at top
3. Include: Zoom controls (+, -, reset), Delete selected button

**Validation:** Select sticky note tool, click canvas, note appears. Select rectangle tool, click canvas, rectangle appears. Delete button removes selected object.

---

### Task 1.12: Firebase Security Rules

**Goal:** Lock down Firebase so only authenticated users can read/write their boards.

**Firestore rules:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId} {
      allow read, write: if request.auth != null;
      match /objects/{objectId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

**Realtime Database rules:**
```json
{
  "rules": {
    "boards": {
      "$boardId": {
        "cursors": {
          "$uid": {
            ".read": "auth != null",
            ".write": "auth != null && auth.uid === $uid"
          }
        },
        "presence": {
          "$uid": {
            ".read": "auth != null",
            ".write": "auth != null && auth.uid === $uid"
          }
        }
      }
    }
  }
}
```

**Note:** Users can only write their own cursor/presence data but can read everyone's. Board objects are writable by any authenticated user (no per-user restrictions needed for this scope).

**Validation:** Sign out. Try to access Firestore directly — should be denied. Sign in. CRUD operations work.

---

### Task 1.13: Deployment Verification

**Goal:** The full MVP is deployed, publicly accessible, and passes all evaluator test scenarios.

**Steps:**
1. Push to GitHub, Vercel auto-deploys
2. Verify env vars are set in Vercel dashboard
3. Run through ALL evaluator test scenarios:
   - [ ] Two users editing simultaneously (different browsers/profiles)
   - [ ] Refresh mid-edit — all state persists
   - [ ] Rapid creation and movement of notes/shapes
   - [ ] Close one tab — presence updates, objects persist
   - [ ] Cursors move smoothly with name labels
4. Share deployed URL

**Validation:** Hand the URL to someone else. They can sign in, see your cursor, create objects, and everything syncs.

---

# PHASE 2 — Full Feature Set (Days 2–4)

## Task 2.1: Additional Shape Types

**Goal:** Circle and line shapes.

- Circle: Konva `Circle` component, uses radius instead of width/height
- Line: Konva `Line` component, needs start/end points
- Add toolbar buttons for each
- Ensure all sync via the same board-operations pipeline

---

## Task 2.2: Connectors

**Goal:** Lines/arrows that connect two objects and update when objects move.

**Steps:**
1. Create `components/canvas/Connector.tsx`:
   - Konva `Arrow` or `Line` component
   - `fromId` and `toId` reference board objects
   - Calculates start/end points from the source/target object positions
   - Recalculates on every render (reactive to object position changes)
2. Add to `board-operations.ts`:
   - `createConnector(boardId, fromId, toId, style)` — validates both objects exist
3. Creation UX: User selects connector tool, clicks source object, clicks target object

**Validation:** Create two shapes. Draw a connector between them. Move one shape — connector endpoint follows. Syncs to other users.

---

## Task 2.3: Frames

**Goal:** Rectangular regions that group and organize content areas.

**Steps:**
1. Create `components/canvas/Frame.tsx`:
   - Large rectangle with a title label at the top
   - Semi-transparent background
   - Objects inside the frame visually appear grouped
   - Frame renders behind (lower zIndex than) objects
2. Add `createFrame()` to board-operations
3. Frames don't physically contain objects (no parent-child in data model) — they're visual grouping only

**Validation:** Create a frame labeled "Sprint Planning". Place sticky notes inside it visually. Frame and notes sync independently.

---

## Task 2.4: Standalone Text Elements

**Goal:** Text placed directly on the board (not inside a sticky note).

**Steps:**
1. Create `components/canvas/TextElement.tsx`:
   - Konva `Text` component, draggable
   - Double-click to edit (same HTML overlay pattern as sticky notes)
   - Configurable font size, color
2. Add `createText()` to board-operations

---

## Task 2.5: Multi-Select

**Goal:** Select multiple objects via shift-click or drag-to-select.

**Steps:**
1. Shift-click adds/removes from selection set
2. Drag-to-select: when no tool is active and user drags on empty canvas, draw a selection rectangle. On release, select all objects within the rectangle bounds.
3. `SelectionBox.tsx` — renders the selection rectangle during drag
4. Group operations on multi-selected objects: move all, delete all, duplicate all

---

## Task 2.6: Copy/Paste and Duplicate

**Goal:** Users can duplicate objects or copy/paste.

- Duplicate: Create a copy offset by (20, 20) from original
- Copy/paste: Store copied objects in local state, paste at cursor position
- Support multi-select copy/paste
- Keyboard shortcuts: Ctrl+C, Ctrl+V, Ctrl+D (duplicate)

---

## Task 2.7: Keyboard Shortcuts

- `Delete` / `Backspace` — delete selected objects
- `Ctrl+A` — select all
- `Ctrl+C` / `Ctrl+V` — copy / paste
- `Ctrl+D` — duplicate
- `Ctrl+Z` / `Ctrl+Shift+Z` — undo / redo (stretch goal — complex with multiplayer)
- `Escape` — deselect all
- `Space + drag` — pan canvas (alternative to middle-click)

---

## Task 2.8: AI Board Agent — Basic Commands

**Goal:** AI agent that creates and manipulates board objects via natural language. Minimum 6 command types.

### API Endpoint (`app/api/ai-command/route.ts`)

```typescript
// POST /api/ai-command
// Body: { boardId: string, command: string, userId: string }
// Response: { success: boolean, result: string, objectsCreated?: string[] }
```

**Steps:**
1. Receive natural language command from client
2. Call `getBoardState()` to provide Claude with current board context
3. Send to Claude Sonnet 4 with tool-use definitions
4. Execute returned tool calls via board-operations.ts (server-side Firebase Admin SDK)
5. Return results to client

**Important:** The AI endpoint needs the Firebase Admin SDK (not the client SDK) since it runs server-side. Install `firebase-admin` and initialize with a service account.

### Tool Definitions for Claude

Define these tools in `lib/ai-tools.ts`:

```typescript
const tools = [
  {
    name: "createStickyNote",
    description: "Create a sticky note on the board",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text content of the sticky note" },
        x: { type: "number", description: "X position on the board" },
        y: { type: "number", description: "Y position on the board" },
        color: { type: "string", description: "Hex color (e.g., '#fef08a' for yellow, '#fca5a5' for red, '#86efac' for green, '#93c5fd' for blue)" }
      },
      required: ["text", "x", "y"]
    }
  },
  {
    name: "createShape",
    description: "Create a shape (rectangle, circle, or line) on the board",
    input_schema: {
      type: "object",
      properties: {
        shapeType: { type: "string", enum: ["rectangle", "circle", "line"] },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        fill: { type: "string", description: "Fill color as hex" },
        stroke: { type: "string", description: "Stroke color as hex" }
      },
      required: ["shapeType", "x", "y", "width", "height"]
    }
  },
  {
    name: "createFrame",
    description: "Create a frame to group content on the board",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" }
      },
      required: ["title", "x", "y", "width", "height"]
    }
  },
  {
    name: "createConnector",
    description: "Create a line or arrow connecting two objects",
    input_schema: {
      type: "object",
      properties: {
        fromId: { type: "string", description: "ID of the source object" },
        toId: { type: "string", description: "ID of the target object" },
        style: { type: "string", enum: ["line", "arrow"] }
      },
      required: ["fromId", "toId"]
    }
  },
  {
    name: "moveObject",
    description: "Move an object to a new position",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["objectId", "x", "y"]
    }
  },
  {
    name: "resizeObject",
    description: "Resize an object",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        width: { type: "number" },
        height: { type: "number" }
      },
      required: ["objectId", "width", "height"]
    }
  },
  {
    name: "updateText",
    description: "Update the text content of a sticky note or text element",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        newText: { type: "string" }
      },
      required: ["objectId", "newText"]
    }
  },
  {
    name: "changeColor",
    description: "Change the color of an object",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        color: { type: "string", description: "New hex color" }
      },
      required: ["objectId", "color"]
    }
  },
  {
    name: "getBoardState",
    description: "Get all current objects on the board for context",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "deleteObject",
    description: "Delete an object from the board",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" }
      },
      required: ["objectId"]
    }
  }
];
```

### System Prompt for Claude

```
You are an AI assistant that manipulates a collaborative whiteboard. You can create, move, resize, and modify objects on the board.

When given a command, analyze what the user wants and use the available tools to accomplish it. For complex requests (like "Create a SWOT analysis"), break the task into multiple tool calls executed sequentially.

Board coordinate system: x increases rightward, y increases downward. Typical sticky note size is 200x200. Space objects at least 220px apart for readability.

Color palette:
- Yellow: #fef08a
- Pink/Red: #fca5a5
- Green: #86efac
- Blue: #93c5fd
- Purple: #d8b4fe
- Orange: #fdba74
- White: #ffffff

When arranging objects in grids, use consistent spacing (220px horizontal, 240px vertical for sticky notes).
```

### Required Command Types (minimum 6)

1. **Creation:** "Add a yellow sticky note that says 'User Research'"
2. **Manipulation:** "Move all the pink sticky notes to the right side"
3. **Layout:** "Arrange these sticky notes in a grid"
4. **Color change:** "Change the sticky note color to green"
5. **Text update:** "Rename the frame to 'Q1 Planning'"
6. **Complex/Template:** "Create a SWOT analysis template"

---

## Task 2.9: AI Board Agent — Complex Commands

**Goal:** Multi-step template generation.

**Required complex commands:**

1. **SWOT Analysis:** "Create a SWOT analysis"
   - 4 frames labeled Strengths, Weaknesses, Opportunities, Threats
   - Arranged in 2×2 grid
   - Each frame has a colored header sticky note

2. **User Journey Map:** "Build a user journey map with 5 stages"
   - 5 frames in a horizontal row
   - Each labeled with a stage (Awareness, Consideration, Purchase, Retention, Advocacy)
   - Connectors between stages

3. **Retrospective Board:** "Set up a retrospective board"
   - 3 columns: What Went Well, What Didn't, Action Items
   - Each column is a frame with header
   - Blank sticky notes inside each for participants to fill

4. **Grid layout:** "Create a 2×3 grid of sticky notes for pros and cons"
   - Precisely positioned sticky notes with consistent spacing

**Implementation:** Claude handles multi-step commands naturally with sequential tool calls. The system prompt guides spacing and layout conventions. Each tool call executes through board-operations.ts and syncs via Firestore — all users see results in real time.

---

## Task 2.10: AI Command UI

**Goal:** Clean input interface for AI commands.

**Steps:**
1. Create `components/ai/AICommandInput.tsx`:
   - Text input + submit button at the bottom of the screen
   - Loading state while AI processes
   - Success/error feedback
   - Command history (local state, last 10 commands)
2. Create `hooks/useAIAgent.ts`:
   - Manages command submission, loading state, error handling
   - POST to `/api/ai-command` with boardId, command, userId
3. Rate limiting: Disable submit button for 2 seconds after each command

**Validation:** Type "Create a yellow sticky note that says Hello". Note appears on board within 2 seconds. Other users see it appear in real time.

---

## Task 2.11: Shared AI State

**Goal:** Multiple users can issue AI commands simultaneously without conflict.

- AI-generated objects go through the same board-operations pipeline as human-created objects
- Firestore handles concurrent writes (last-write-wins)
- Each AI command operates independently — no shared queue
- All users see AI results because they come through Firestore listeners

**Validation:** Two users both issue AI commands at the same time. Both commands execute. All results visible to both users.

---

# PHASE 3 — Polish & Submission (Days 5–7)

## Task 3.1: Performance Optimization

- Canvas rendering: Only render objects within the visible viewport (frustum culling)
- Konva layer separation: Static objects on one layer, active/dragging objects on another
- Throttle Firestore writes during drag operations (write on dragEnd, not during drag)
- Test with 500+ objects — programmatically create them and measure FPS
- Cursor position throttling confirmed at 20-30Hz

## Task 3.2: Disconnect/Reconnect Handling

- Firestore has built-in offline persistence — enable it
- RTDB presence uses `onDisconnect()` — already handles tab close
- On reconnect, Firestore listeners automatically re-sync
- Add visual indicator when connection is lost ("Reconnecting...")
- Test: disable WiFi for 30 seconds, re-enable, verify state recovers

## Task 3.3: UI Polish

- Smooth animations on object creation (fade in)
- Cursor color matches presence avatar color
- Zoom percentage display
- Mini-map (stretch goal)
- Dark/light mode (stretch goal)
- Mobile-responsive toolbar (stretch goal)

## Task 3.4: Documentation

**GitHub README must include:**
- Project description
- Tech stack and architecture overview
- Setup guide (local development)
- Environment variables needed
- Deployed link
- Architecture diagram

## Task 3.5: Demo Video (3-5 minutes)

Cover in order:
1. Real-time collaboration demo (two users, cursors, object sync)
2. AI agent commands (basic creation, complex templates like SWOT)
3. Architecture explanation (tech stack, data flow, why these choices)
4. Any unique features or extensions

## Task 3.6: AI Development Log

1-page document covering:
- Tools used (Claude Code, Codex) and integration workflow
- MCP usage (if any)
- 3-5 effective prompts (include actual prompts)
- Rough % AI-generated vs hand-written code
- Where AI excelled, where it struggled
- Key learnings about working with coding agents

## Task 3.7: AI Cost Analysis

**Development costs:** Track actual Anthropic API spend, total tokens, number of API calls.

**Production projections table:**

| Scale | Users | Est. Monthly Cost | Assumptions |
|---|---|---|---|
| Small | 100 | $___/month | ___ AI commands/user/session, ___ sessions/user/month |
| Medium | 1,000 | $___/month | Same per-user assumptions |
| Large | 10,000 | $___/month | Same per-user assumptions |
| Scale | 100,000 | $___/month | Same per-user assumptions |

Include: AI API costs, Firebase costs (Firestore reads/writes, RTDB bandwidth), Vercel costs.

## Task 3.8: Social Post

Share on X or LinkedIn:
- Description of what you built
- Key features
- Demo video or screenshots
- Tag @GauntletAI

---

# Submission Checklist

**Deadline: Sunday 11:59 PM CT**

- [ ] GitHub Repository with setup guide, architecture overview, deployed link
- [ ] Demo Video (3-5 min) covering real-time collab, AI commands, architecture
- [x] Pre-Search Document (completed)
- [ ] AI Development Log (1 page)
- [ ] AI Cost Analysis (dev spend + projections)
- [ ] Deployed Application (publicly accessible, supports 5+ users with auth)
- [ ] Social Post (X or LinkedIn, tag @GauntletAI)