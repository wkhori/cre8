// ── Base shape with shared fields ──────────────────────────────────
export interface BaseShape {
  id: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  parentId?: string;
}

// ── Concrete shape types ───────────────────────────────────────────
export interface RectShape extends BaseShape {
  type: "rect";
  w: number;
  h: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface CircleShape extends BaseShape {
  type: "circle";
  radiusX: number;
  radiusY: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface TextShape extends BaseShape {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  width?: number;
  align?: "left" | "center" | "right";
  fontStyle?: "normal" | "bold" | "italic" | "bold italic";
  textDecoration?: "none" | "underline";
}

export interface LineShape extends BaseShape {
  type: "line";
  points: number[]; // [x1,y1, x2,y2, ...]
  stroke: string;
  strokeWidth: number;
}

export interface StickyNoteShape extends BaseShape {
  type: "sticky";
  w: number;
  h: number;
  text: string;
  color: string; // background hex color
  fontSize?: number;
  fontStyle?: "normal" | "bold" | "italic" | "bold italic";
  fontFamily?: string;
  textDecoration?: "none" | "underline";
}

export interface FrameShape extends BaseShape {
  type: "frame";
  w: number;
  h: number;
  title: string;
  fill: string; // background (semi-transparent)
  stroke: string;
}

export interface ImageShape extends BaseShape {
  type: "image";
  w: number;
  h: number;
  src: string;
}

export interface ConnectorShape extends BaseShape {
  type: "connector";
  fromId?: string | null;
  toId?: string | null;
  fromPoint?: { x: number; y: number } | null;
  toPoint?: { x: number; y: number } | null;
  style: "line" | "arrow" | "double-arrow";
  stroke: string;
  strokeWidth: number;
  points?: number[]; // computed from connected objects
  lineStyle?: "solid" | "dashed" | "dotted";
}

// ── Discriminated union ────────────────────────────────────────────
export type Shape =
  | RectShape
  | CircleShape
  | TextShape
  | LineShape
  | StickyNoteShape
  | FrameShape
  | ImageShape
  | ConnectorShape;

export type ShapeType = Shape["type"];

// ── Viewport ───────────────────────────────────────────────────────
export interface Viewport {
  scale: number;
  x: number;
  y: number;
}
