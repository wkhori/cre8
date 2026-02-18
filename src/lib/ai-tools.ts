import type Anthropic from "@anthropic-ai/sdk";

// ── Operation types returned to the client ─────────────────────────
export type AIOperation =
  | {
      type: "createStickyNote";
      tempId: string;
      x: number;
      y: number;
      text: string;
      color?: string;
      w?: number;
      h?: number;
    }
  | {
      type: "createShape";
      tempId: string;
      shapeType: "rectangle" | "circle";
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
    }
  | {
      type: "createText";
      tempId: string;
      x: number;
      y: number;
      text: string;
      fontSize?: number;
      fill?: string;
    }
  | {
      type: "createFrame";
      tempId: string;
      x: number;
      y: number;
      title: string;
      w?: number;
      h?: number;
    }
  | {
      type: "createConnector";
      tempId: string;
      fromId: string;
      toId: string;
      style?: "line" | "arrow";
    }
  | { type: "moveObject"; objectId: string; x: number; y: number }
  | { type: "updateText"; objectId: string; newText: string }
  | { type: "changeColor"; objectId: string; color: string }
  | { type: "deleteObject"; objectId: string }
  | { type: "resizeObject"; objectId: string; w: number; h: number };

// ── Tool definitions for Claude ────────────────────────────────────
// All x/y coordinates are TOP-LEFT corner of the bounding box.
export const AI_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "createStickyNote",
    description: "Create a sticky note on the board.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text content (keep short: 2-8 words)" },
        x: { type: "number", description: "X of top-left corner" },
        y: { type: "number", description: "Y of top-left corner" },
        color: {
          type: "string",
          description:
            "Hex background color. Options: #fef08a yellow (default), #fecdd3 pink, #bbf7d0 green, #bfdbfe blue, #e9d5ff purple, #fed7aa orange",
        },
        width: { type: "number", description: "Width in px (default 260)" },
        height: { type: "number", description: "Height in px (default 120)" },
      },
      required: ["text", "x", "y"],
    },
  },
  {
    name: "createFrame",
    description: "Create a frame to visually group content. Frames render behind other objects. Title appears above the top-left corner.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Frame title text" },
        x: { type: "number", description: "X of top-left corner" },
        y: { type: "number", description: "Y of top-left corner" },
        width: { type: "number", description: "Width in px (default 400)" },
        height: { type: "number", description: "Height in px (default 300)" },
      },
      required: ["title", "x", "y"],
    },
  },
  {
    name: "createShape",
    description: "Create a rectangle or circle shape on the board.",
    input_schema: {
      type: "object",
      properties: {
        shapeType: {
          type: "string",
          enum: ["rectangle", "circle"],
          description: "Type of shape",
        },
        x: { type: "number", description: "X of top-left corner of bounding box" },
        y: { type: "number", description: "Y of top-left corner of bounding box" },
        width: { type: "number", description: "Width of bounding box" },
        height: { type: "number", description: "Height of bounding box" },
        fill: { type: "string", description: "Fill color as hex (default #3b82f6)" },
      },
      required: ["shapeType", "x", "y", "width", "height"],
    },
  },
  {
    name: "createText",
    description: "Create a standalone text label on the board.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text content" },
        x: { type: "number", description: "X of top-left corner" },
        y: { type: "number", description: "Y of top-left corner" },
        fontSize: { type: "number", description: "Font size in px (default 24)" },
        fill: { type: "string", description: "Text color as hex" },
      },
      required: ["text", "x", "y"],
    },
  },
  {
    name: "createConnector",
    description: "Create an arrow or line connecting two objects by their IDs.",
    input_schema: {
      type: "object",
      properties: {
        fromId: { type: "string", description: "Source object ID" },
        toId: { type: "string", description: "Target object ID" },
        style: {
          type: "string",
          enum: ["line", "arrow"],
          description: "Connector style (default: arrow)",
        },
      },
      required: ["fromId", "toId"],
    },
  },
  {
    name: "moveObject",
    description: "Move an existing object to a new top-left position.",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "ID of the object to move" },
        x: { type: "number", description: "New X (top-left)" },
        y: { type: "number", description: "New Y (top-left)" },
      },
      required: ["objectId", "x", "y"],
    },
  },
  {
    name: "resizeObject",
    description: "Resize an existing object.",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "ID of the object to resize" },
        width: { type: "number", description: "New width" },
        height: { type: "number", description: "New height" },
      },
      required: ["objectId", "width", "height"],
    },
  },
  {
    name: "updateText",
    description: "Update the text of a sticky note, text element, or frame title.",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "ID of the object" },
        newText: { type: "string", description: "New text content" },
      },
      required: ["objectId", "newText"],
    },
  },
  {
    name: "changeColor",
    description: "Change the color of an object.",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "ID of the object" },
        color: { type: "string", description: "New hex color" },
      },
      required: ["objectId", "color"],
    },
  },
  {
    name: "deleteObject",
    description: "Delete an object from the board.",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "ID of the object to delete" },
      },
      required: ["objectId"],
    },
  },
  {
    name: "getBoardState",
    description: "Get all current objects on the board with their IDs, positions, and properties. Use this before modifying existing objects.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];
