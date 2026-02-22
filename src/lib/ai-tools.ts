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
      fontFamily?: string;
      fontStyle?: "normal" | "bold" | "italic" | "bold italic";
      textDecoration?: "none" | "underline";
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
      width?: number;
      fontFamily?: string;
      fontStyle?: "normal" | "bold" | "italic" | "bold italic";
      textDecoration?: "none" | "underline";
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
      style?: "line" | "arrow" | "double-arrow";
      lineStyle?: "solid" | "dashed" | "dotted";
    }
  | { type: "moveObject"; objectId: string; x: number; y: number }
  | {
      type: "updateText";
      objectId: string;
      newText: string;
      fontFamily?: string;
      fontStyle?: "normal" | "bold" | "italic" | "bold italic";
      textDecoration?: "none" | "underline";
    }
  | { type: "changeColor"; objectId: string; color: string }
  | {
      type: "updateConnector";
      objectId: string;
      style?: "line" | "arrow" | "double-arrow";
      lineStyle?: "solid" | "dashed" | "dotted";
      strokeWidth?: number;
    }
  | { type: "deleteObjects"; objectIds: string[] }
  | { type: "resizeObject"; objectId: string; w: number; h: number }
  | {
      type: "createGrid";
      tempId: string;
      x: number;
      y: number;
      columns: number;
      rows: number;
      cells: {
        title: string;
        color?: string;
        items: string[];
      }[];
      cellWidth?: number;
      cellHeight?: number;
    }
  | {
      type: "createRow";
      tempId: string;
      x: number;
      y: number;
      frames: {
        title: string;
        color?: string;
        items: string[];
      }[];
      frameWidth?: number;
      frameHeight?: number;
      connectors?: boolean;
    }
  | {
      type: "createFlowchart";
      tempId: string;
      x: number;
      y: number;
      steps: {
        label: string;
        description?: string;
        color?: string;
      }[];
      direction?: "horizontal" | "vertical";
      nodeWidth?: number;
      nodeHeight?: number;
    }
  | {
      type: "createMindMap";
      tempId: string;
      x: number;
      y: number;
      centerLabel: string;
      branches: {
        label: string;
        color?: string;
        children?: string[];
      }[];
    };

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
        fontFamily: {
          type: "string",
          description:
            "Font family. Options: 'Inter, system-ui, sans-serif' (default), 'Georgia, serif', \"'Courier New', monospace\", 'cursive'",
        },
        fontStyle: {
          type: "string",
          enum: ["normal", "bold", "italic", "bold italic"],
          description:
            "Font style (default: normal). Use 'bold' for bold, 'italic' for italic, 'bold italic' for both.",
        },
        textDecoration: {
          type: "string",
          enum: ["none", "underline"],
          description: "Text decoration (default: none)",
        },
      },
      required: ["text", "x", "y"],
    },
  },
  {
    name: "createFrame",
    description:
      "Create a frame to visually group content. Frames render behind other objects. Title appears above the top-left corner.",
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
        width: {
          type: "number",
          description: "Max text width in px. Auto-calculated from text length if omitted.",
        },
        fontFamily: {
          type: "string",
          description:
            "Font family. Options: 'Inter, system-ui, sans-serif' (default), 'Georgia, serif', \"'Courier New', monospace\", 'cursive'",
        },
        fontStyle: {
          type: "string",
          enum: ["normal", "bold", "italic", "bold italic"],
          description:
            "Font style (default: normal). Use 'bold' for bold, 'italic' for italic, 'bold italic' for both.",
        },
        textDecoration: {
          type: "string",
          enum: ["none", "underline"],
          description: "Text decoration (default: none)",
        },
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
          enum: ["line", "arrow", "double-arrow"],
          description:
            "Connector endpoint style (default: arrow). double-arrow has arrowheads on both ends.",
        },
        lineStyle: {
          type: "string",
          enum: ["solid", "dashed", "dotted"],
          description: "Line pattern (default: solid)",
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
        fontFamily: {
          type: "string",
          description:
            "Font family. Options: 'Inter, system-ui, sans-serif', 'Georgia, serif', \"'Courier New', monospace\", 'cursive'",
        },
        fontStyle: {
          type: "string",
          enum: ["normal", "bold", "italic", "bold italic"],
          description:
            "Font style. Use 'bold' for bold, 'italic' for italic, 'bold italic' for both.",
        },
        textDecoration: {
          type: "string",
          enum: ["none", "underline"],
          description: "Text decoration",
        },
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
    name: "updateConnector",
    description:
      "Update the style of an existing connector. Can change endpoint style, line pattern, and stroke width.",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "ID of the connector to update" },
        style: {
          type: "string",
          enum: ["line", "arrow", "double-arrow"],
          description: "Endpoint style",
        },
        lineStyle: {
          type: "string",
          enum: ["solid", "dashed", "dotted"],
          description: "Line pattern",
        },
        strokeWidth: {
          type: "number",
          description: "Stroke width in px (1=thin, 2=regular, 4=thick)",
        },
      },
      required: ["objectId"],
    },
  },
  {
    name: "deleteObjects",
    description:
      "Delete one or more objects from the board. Pass all object IDs to remove — there is no limit.",
    input_schema: {
      type: "object",
      properties: {
        objectIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of object IDs to delete",
        },
      },
      required: ["objectIds"],
    },
  },
  {
    name: "getBoardState",
    description:
      "Get all current objects on the board with their IDs, positions, and properties. Use this before modifying existing objects.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "createGrid",
    description:
      "Create a grid of titled frames with sticky notes inside. Best for categorized lists (SWOT, pros/cons, comparisons). Frame heights auto-size to fit all items. Provide cells in row-major order (left to right, top to bottom).",
    input_schema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X of top-left corner of the entire grid" },
        y: { type: "number", description: "Y of top-left corner of the entire grid" },
        columns: { type: "number", description: "Number of columns (e.g. 2 for a 2×2)" },
        rows: { type: "number", description: "Number of rows (e.g. 2 for a 2×2)" },
        cells: {
          type: "array",
          description: "Array of cells in row-major order. Length must equal rows × columns.",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Frame title" },
              color: {
                type: "string",
                description: "Sticky note color for this cell (hex). Default: #fef08a",
              },
              items: {
                type: "array",
                items: { type: "string" },
                description: "Sticky note texts (2-8 words each)",
              },
            },
            required: ["title", "items"],
          },
        },
        cellWidth: { type: "number", description: "Width per cell frame (default 450)" },
        cellHeight: { type: "number", description: "Height per cell frame (default 380)" },
      },
      required: ["x", "y", "columns", "rows", "cells"],
    },
  },
  {
    name: "createRow",
    description:
      "Create a horizontal row of titled frames with sticky notes inside. Best for kanban, retro boards, timelines. Frame heights auto-size to fit all items. Optionally add arrow connectors between consecutive frames.",
    input_schema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X of top-left corner of the first frame" },
        y: { type: "number", description: "Y of top-left corner of the row" },
        frames: {
          type: "array",
          description: "Array of frames from left to right.",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Frame title" },
              color: {
                type: "string",
                description: "Sticky note color for this frame (hex). Default: #fef08a",
              },
              items: {
                type: "array",
                items: { type: "string" },
                description: "Sticky note texts (2-8 words each)",
              },
            },
            required: ["title", "items"],
          },
        },
        frameWidth: { type: "number", description: "Width per frame (default 380)" },
        frameHeight: { type: "number", description: "Height per frame (default 420)" },
        connectors: {
          type: "boolean",
          description: "Add arrow connectors between consecutive frames (default false)",
        },
      },
      required: ["x", "y", "frames"],
    },
  },
  {
    name: "createFlowchart",
    description:
      "Create a flowchart with connected steps. Best for processes, workflows, user flows, decision trees. Steps are laid out as rounded rectangles with arrow connectors.",
    input_schema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X of top-left corner of the flowchart" },
        y: { type: "number", description: "Y of top-left corner of the flowchart" },
        steps: {
          type: "array",
          description: "Ordered array of process steps.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Step title (2-6 words)" },
              description: { type: "string", description: "Optional detail text below the step" },
              color: { type: "string", description: "Fill color as hex (default: #3b82f6)" },
            },
            required: ["label"],
          },
        },
        direction: {
          type: "string",
          enum: ["horizontal", "vertical"],
          description: "Layout direction (default: horizontal)",
        },
        nodeWidth: { type: "number", description: "Width of each step box (default 200)" },
        nodeHeight: { type: "number", description: "Height of each step box (default 80)" },
      },
      required: ["x", "y", "steps"],
    },
  },
  {
    name: "createMindMap",
    description:
      "Create a mind map with a central topic and radiating branches. Best for brainstorming, topic exploration, idea organization. Branches spread evenly around the center node.",
    input_schema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X center of the mind map" },
        y: { type: "number", description: "Y center of the mind map" },
        centerLabel: { type: "string", description: "Central topic text" },
        branches: {
          type: "array",
          description: "Array of branches radiating from center.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Branch label (2-5 words)" },
              color: { type: "string", description: "Branch node fill color (hex)" },
              children: {
                type: "array",
                items: { type: "string" },
                description: "Sub-items as sticky notes (2-6 words each)",
              },
            },
            required: ["label"],
          },
        },
      },
      required: ["x", "y", "centerLabel", "branches"],
    },
  },
];
