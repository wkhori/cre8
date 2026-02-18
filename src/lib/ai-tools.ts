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
export const AI_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "createStickyNote",
    description: "Create a sticky note on the board",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text content of the sticky note" },
        x: { type: "number", description: "X position (center) on the board" },
        y: { type: "number", description: "Y position (center) on the board" },
        color: {
          type: "string",
          description:
            "Hex background color (default: #fef08a yellow). Options: #fef08a yellow, #fecdd3 pink, #bbf7d0 green, #bfdbfe blue, #e9d5ff purple, #fed7aa orange",
        },
        width: { type: "number", description: "Width in pixels (default: 260). Use 180 for short text, 260 for medium, 300 for long text." },
        height: {
          type: "number",
          description: "Height in pixels (default: 120). Use 100 for short text, 120 for medium, 140 for long text.",
        },
      },
      required: ["text", "x", "y"],
    },
  },
  {
    name: "createFrame",
    description:
      "Create a frame to visually group content on the board. Frames render behind other objects.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Frame title text" },
        x: { type: "number", description: "X position (center)" },
        y: { type: "number", description: "Y position (center)" },
        width: {
          type: "number",
          description: "Width in pixels (default: 400)",
        },
        height: {
          type: "number",
          description: "Height in pixels (default: 300)",
        },
      },
      required: ["title", "x", "y"],
    },
  },
  {
    name: "createShape",
    description: "Create a rectangle or circle shape on the board",
    input_schema: {
      type: "object",
      properties: {
        shapeType: {
          type: "string",
          enum: ["rectangle", "circle"],
          description: "Type of shape to create",
        },
        x: { type: "number", description: "X position (center)" },
        y: { type: "number", description: "Y position (center)" },
        width: { type: "number", description: "Width (or diameter for circle)" },
        height: {
          type: "number",
          description: "Height (or diameter for circle)",
        },
        fill: { type: "string", description: "Fill color as hex" },
      },
      required: ["shapeType", "x", "y", "width", "height"],
    },
  },
  {
    name: "createText",
    description: "Create a standalone text element on the board",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text content" },
        x: { type: "number", description: "X position" },
        y: { type: "number", description: "Y position" },
        fontSize: { type: "number", description: "Font size (default: 24)" },
        fill: { type: "string", description: "Text color as hex" },
      },
      required: ["text", "x", "y"],
    },
  },
  {
    name: "createConnector",
    description:
      "Create a line or arrow connecting two objects by their IDs. Use getBoardState to find IDs first.",
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
    description: "Move an existing object to a new position",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "ID of the object to move" },
        x: { type: "number", description: "New X position" },
        y: { type: "number", description: "New Y position" },
      },
      required: ["objectId", "x", "y"],
    },
  },
  {
    name: "resizeObject",
    description: "Resize an existing object",
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
    description: "Update the text content of a sticky note, text element, or frame title",
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
    description:
      "Change the color of an object (fill for shapes, color for sticky notes, stroke for connectors)",
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
    description: "Delete an object from the board",
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
    description:
      "Get all current objects on the board. Use this to find object IDs before moving, updating, or deleting objects.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];
