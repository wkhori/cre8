# Architecture Diagram — Future Improvements

A roadmap for making the analyze-repo architecture diagrams look professional, unique per repo, and compelling enough that developers want to embed them in their READMEs.

The north star: **Apple's M1 chip diagram** — clean hierarchy, restrained color, purposeful whitespace, every element earns its place.

---

## Tier 1: High-Impact Visual Polish

### 1. Gradient Header Bands

**Current:** Each layer has a flat solid-color header band (32px).
**Proposed:** Left-to-right gradient that fades from the palette color at ~85% opacity on the left to transparent on the right. Creates a directional light effect that feels dimensional without being garish.

- Konva doesn't support CSS gradients, but we can approximate with 3-4 overlapping rects at decreasing opacity and increasing x-offset
- Alternatively, generate a 1-row canvas gradient offscreen, export as data URI, render as Image shape
- Fallback: keep solid for simplicity, but add a subtle lighter stripe (2px) along the top edge of the header band — simulates a top-lit surface

**Impact:** Every layer header instantly looks more refined. Currently the flat color blocks are the most "default" part of the design.

---

### 2. Softer, More Realistic Shadows

**Current:** Each component card has a single solid `rgba(0,0,0,0.35)` rectangle offset by (3,3)px. Looks like a hard cutout.
**Proposed:** Multi-layer shadow stack:
- Layer 1: offset (1,1), `rgba(0,0,0,0.15)`, slight blur approximation via larger size + corner radius
- Layer 2: offset (4,4), `rgba(0,0,0,0.10)`, even larger for diffuse glow
- Layer 3 (optional): offset (0,8), `rgba(0,0,0,0.06)`, distant ambient shadow

Konva has no blur on shapes, but stacking 2-3 rects with progressively lower opacity and larger offsets creates a convincing soft shadow. Apple uses this exact technique in their diagrams.

**Impact:** Cards go from "floating sticky notes" to "physical objects with depth." One of the biggest upgrades for perceived quality.

---

### 3. Typography Refinement

**Current:** Title 32px bold, description 13px, layer names 13px bold, component names 12px bold, tech labels 9px.
**Proposed adjustments:**
- **Title:** Reduce to 26-28px. 32px is oversized for most diagram widths and competes with the content. Consider light weight instead of bold for elegance.
- **Description:** Bump to 14px, use a warmer gray (`#a8b2c1`) instead of the cold `#94a3b8`
- **Section labels:** Current 10px uppercase is good but add letter-spacing (Konva supports `letterSpacing` prop) — `letterSpacing: 2` for that Apple small-caps feel
- **Layer names:** Keep 13px bold but ensure consistent baseline alignment with any adjacent elements
- **Component names:** 12px is fine, but if there's no techStack label, vertically center the name in the card (already done)
- **Tech labels:** 9px is at the readability edge. Consider 10px with slightly more opacity (`0.5` instead of `0.4`)

**Impact:** Typography is the single biggest quality signal. Bad type = amateur, good type = professional. These are subtle tweaks but compound into a dramatically different feel.

---

### 4. Card Interior Layout

**Current:** Icon (14px) + name + tech label stacked left-aligned with fixed padding.
**Proposed:**
- Add 1px separator line between the card and the header band area (currently cards float in the layer body with no visual anchor)
- Consider a thin left-edge accent bar (2px wide, palette.header color) on each card instead of inline icon — gives visual rhythm without icon-loading dependency
- When a card has both icon and tech label, the vertical spacing feels cramped at 52px height. Either:
  - Increase card height to 58px (gives 3px more breathing room per line)
  - OR remove tech label entirely and rely on the layer-level context (layer name + description already convey tech)

**Impact:** Cards are the most repeated element. Small improvements multiply across every component on every diagram.

---

## Tier 2: Layout & Structural Improvements

### 5. Proportional Section Sizing

**Current:** All sections use the same internal padding and gap values regardless of their component count.
**Proposed:** Sections with 1-2 components total should use tighter padding (10px instead of 14px) and smaller layer gaps (20px instead of 28px). Sections with 4+ components per layer should use wider padding. This makes small utility sections feel compact and large feature sections feel expansive — matching their actual importance.

Formula: `sectionPad = clamp(10, 10 + componentCount * 1.5, 20)`

**Impact:** Diagrams with mixed-size sections (common: a large frontend section + a small infra section) currently waste space on the small section. Proportional sizing makes the layout feel intentional.

---

### 6. Column Balancing in Bento Mode

**Current:** Greedy shortest-column-first placement. Can produce unbalanced layouts (one column much taller than the other) when section sizes vary.
**Proposed:**
- After initial placement, compute column height difference
- If difference > 20% of the taller column, try swapping the last-placed section between columns
- If still unbalanced, try splitting the tallest section's layers across both columns (only if it has 3+ layers)
- Add a minimum column width ratio: neither column should be less than 35% of total width

**Impact:** Prevents the "one tall column, one short column" problem that makes bento layouts look lopsided.

---

### 7. Smart Component Ordering Within Layers

**Current:** Components render in whatever order Claude returns them.
**Proposed:** Sort components within a layer to create visual flow:
- Components with connections to the next tier below → place toward the center (shorter connector paths)
- Components with many connections → place in the middle column (hub positioning)
- Isolated components (no connections) → place at edges
- This is a layout-time optimization that doesn't change the data model

**Impact:** Reduces connector crossing and creates a more organic, readable flow. Currently some diagrams have connectors that zigzag across the entire width because the connected components ended up on opposite sides.

---

### 8. Responsive Width Calculation

**Current:** Layer width is driven by `maxLayerCols * COMPONENT_W + gaps`. A section with one 5-component layer forces the section to be wide, even if all other layers have 2 components.
**Proposed:**
- Calculate the "natural" width for each layer independently
- Section width = max of all its layers' natural widths
- But if a layer has significantly fewer components than the section width allows, center those components with extra padding rather than stretching them to fill
- Consider wrapping: if a layer has 7+ components, allow a second row rather than making everything ultra-wide

Already partially implemented (MAX_COMPONENTS_PER_ROW = 6) but could be smarter about when to wrap vs extend.

**Impact:** Diagrams for projects with uneven layer sizes look more balanced.

---

## Tier 3: Visual Details & Polish

### 9. Connection Path Improvements

**Current:** Elbowed connectors use Konva's tension-based smoothing. Labels are positioned at midpoint with nudge-away-from-cards logic.
**Proposed:**
- **Orthogonal routing:** For elbowed connectors, compute actual L-shaped or Z-shaped point sequences rather than relying on Konva tension. This gives clean 90-degree turns like Figma/Miro connectors.
  - Vertical-first routing: go down from source, turn horizontal, go to destination column, turn down to destination
  - Horizontal-first routing: go right from source, turn vertical, arrive at destination
  - Choose based on relative positions of source and destination
- **Arrow overlap avoidance:** When multiple connectors share a similar path, offset them by 8-12px so they don't stack on top of each other
- **Curved connectors for cross-section links:** Reserve smooth curves for the rare cross-section connection (currently everything is elbowed). A single elegant curve across the diagram draws the eye to the most important architectural relationship.

**Impact:** Connectors are currently the weakest visual element. Clean orthogonal routing would be a major upgrade.

---

### 10. Subtle Animation Markers (Static)

**Current:** Connectors and labels are static shapes.
**Proposed:** Add small visual markers that *suggest* motion without actual animation:
- Small circle "dot" at connector endpoints (4px, filled with connector color) — common in architecture diagrams
- Directional chevrons (tiny `>` or `v` text) along long connector paths every 80px
- "Pulse" dots at connection midpoints (just a small filled circle, slightly larger than the stroke width)

These are static shapes that create the visual language of data flow without needing animation.

**Impact:** Makes the diagram feel alive and directional. Currently the arrows alone carry the burden of showing flow direction.

---

### 11. Section Divider Lines

**Current:** Sections are separated by a gap (24px) and their tinted backgrounds.
**Proposed:** Add thin dashed lines between columns in multi-column layouts:
- Vertical dashed line between left and right columns: `rgba(255,255,255,0.06)`, 1px, dash [4,8]
- This creates visual separation without adding another background shape
- Only in bento/horizontal mode, not vertical

**Impact:** Small touch that makes multi-column layouts read as intentional side-by-side comparisons rather than accidentally adjacent blocks.

---

### 12. Palette Color Harmony

**Current:** Palettes rotate hue evenly across a spread. Adjacent layers can end up with very similar colors if there are many layers.
**Proposed:**
- Enforce minimum hue distance of 30 degrees between adjacent layers within the same section
- Use complementary or triadic harmony for the most important sections
- For the "mono" theme, vary lightness more aggressively (30-60% range) to create clear visual distinction
- Consider using the *section* as the primary color anchor (all layers in a section share a base hue) with layers varying in lightness/saturation — this would make sections more visually cohesive

**Impact:** Some diagrams currently have two adjacent layers in nearly identical blues or greens. Better color spacing makes the hierarchy immediately readable.

---

### 13. Icon Fallback System

**Current:** If a Simple Icons slug is invalid, the image fails to load and leaves an invisible gap on the card.
**Proposed:**
- Generate a text-based fallback: first 1-2 letters of the tech name in a small colored circle (like avatar initials)
- e.g., if "customframework" slug fails, render a 14px circle with "CF" in 8px text
- The layout engine can't know which icons will fail at render time, so this needs to happen in ShapeRenderer.tsx
- On image load error: replace with a small `<Rect>` + `<Text>` circle combo using the component's palette color

**Impact:** Eliminates the "invisible gap" problem where failed icons leave dead space on cards. Every card looks intentional.

---

### 14. Diagram Footer

**Current:** The diagram ends abruptly after the last section.
**Proposed:** Add a subtle footer area (24px) at the bottom of the backdrop with:
- Small muted text: `"Architecture · {totalComponents} components · {totalConnections} connections"` in 9px `rgba(255,255,255,0.2)`
- Right-aligned: timestamp or version indicator
- This gives the diagram a finished, bounded feel — like a real technical document

**Impact:** Professional diagrams have metadata footers. This small addition signals completeness and intentionality.

---

## Tier 4: Prompt & AI Quality

### 15. Section Naming Guidance

**Current:** Claude chooses section names freely. Results vary: sometimes generic ("Frontend", "Backend"), sometimes too specific ("React Canvas Rendering Pipeline").
**Proposed:** Add prompt guidance:
- Section names should be 1-2 words max
- Prefer architectural terms: "Client", "Services", "Data", "Platform", "Core"
- Avoid technology names in section labels (the icons already convey tech)
- Avoid generic: "Other", "Misc", "Utils"

**Impact:** Consistent, punchy section names improve readability across all repos.

---

### 16. Component Count Guardrails

**Current:** Prompt says "2-5 major components per layer." Claude sometimes returns 1-component layers (wasted row) or layers with 6+ components (cluttered).
**Proposed:**
- Layout-level fix: if a layer has only 1 component, merge it visually with an adjacent same-section layer (shared background, separate header bands)
- Prompt-level fix: "Every layer MUST have at least 2 components. If a concern has only one component, merge it into a related layer."
- Hard cap in layout: if a layer has 7+ components, split into 2 sub-rows automatically

**Impact:** Eliminates wasted space from single-component layers and prevents oversized layers from dominating.

---

### 17. Connection Quality Scoring

**Current:** Claude decides which connections to include based on prompt guidance. Quality varies.
**Proposed:** Post-processing step in the layout engine:
- Score each connection by visual impact: cross-section connections score higher (they reveal non-obvious relationships)
- Same-section, adjacent-tier connections score lower (they're implied by the grouping)
- If more than 4 connections, prune lowest-scoring ones
- If 0 connections, the diagram looks disconnected — add a warning or auto-infer the most likely primary data flow

**Impact:** Ensures every diagram has the right number of connections regardless of Claude's output quality.

---

### 18. Smarter Layout Hint Selection

**Current:** Claude chooses `layoutHint` (vertical/horizontal/bento) based on prompt guidance.
**Proposed:** Override in the layout engine based on actual data:
- If 1-2 sections → force vertical (bento wastes space with few sections)
- If 3+ sections with balanced component counts → bento
- If 2 sections with very different sizes → horizontal
- If all sections have similar sizes → vertical stacks better than bento (no wasted column space)
- The AI's `layoutHint` becomes a *suggestion* that the layout engine can override

**Impact:** Eliminates the case where Claude picks bento for a 2-section project, resulting in an awkward side-by-side with one nearly-empty column.

---

## Tier 5: Stretch Goals

### 19. Light Mode Variant

The current design is dark-mode only. A light variant would:
- Swap backdrop to `#fafbfc` with subtle border
- Cards to white with light gray borders
- Headers to lighter palette tints
- Text to dark grays
- Icons to dark color variants

Could be triggered by a `colorScheme: "light" | "dark"` field in the analysis, or respect the app's current theme.

---

### 20. Export as SVG/PNG

Currently the diagram lives only on the Konva canvas. For README embedding:
- Add an "Export" button that renders the diagram region to PNG via `stage.toDataURL()`
- Or generate an SVG representation from the AIOperation list (since all shapes are simple rects/text/lines)
- Include proper padding, title, and metadata in the export

---

### 21. Minimap / Overview Mode

For very large diagrams (20+ components), add a small-scale overview in the corner showing the full diagram with a viewport indicator. This helps orientation when zoomed in.

---

### 22. Animated Generation

Instead of all shapes appearing at once, stagger creation:
- Backdrop fades in first
- Header and title appear
- Sections slide in one by one
- Components within each section cascade left-to-right
- Connectors draw last, animating along their path

This is purely cosmetic but creates a "wow" moment during generation.

---

## Implementation Priority

| # | Improvement | Effort | Impact | Priority |
|---|---|---|---|---|
| 1 | Gradient header bands | Medium | High | Do next |
| 2 | Softer shadows | Low | High | Do next |
| 3 | Typography refinement | Low | High | Do next |
| 9 | Orthogonal connector routing | High | High | Do next |
| 12 | Palette color harmony | Medium | Medium | Soon |
| 4 | Card interior layout | Low | Medium | Soon |
| 5 | Proportional section sizing | Medium | Medium | Soon |
| 13 | Icon fallback system | Medium | Medium | Soon |
| 14 | Diagram footer | Low | Low | Nice to have |
| 15 | Section naming guidance | Low | Medium | Soon |
| 6 | Column balancing | Medium | Medium | Later |
| 7 | Smart component ordering | High | Medium | Later |
| 16 | Component count guardrails | Medium | Medium | Later |
| 17 | Connection quality scoring | Medium | Medium | Later |
| 18 | Smarter layout hint selection | Low | Medium | Later |
| 8 | Responsive width calculation | Medium | Low | Later |
| 10 | Static animation markers | Low | Low | Nice to have |
| 11 | Section divider lines | Low | Low | Nice to have |
| 19 | Light mode variant | High | Medium | Stretch |
| 20 | Export as SVG/PNG | High | High | Stretch |
| 21 | Minimap | Medium | Low | Stretch |
| 22 | Animated generation | High | Medium | Stretch |
