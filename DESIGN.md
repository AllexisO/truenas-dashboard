---
name: TrueNAS Dashboard
description: Real-time TrueNAS SCALE monitoring dashboard — a dark-first mission-control console for server health.
colors:
  void: "#0A0E1A"
  surface: "#111A2E"
  surface-hover: "#1A2541"
  border: "rgba(255, 255, 255, 0.08)"
  text: "#E2E8F0"
  text-dim: "#98A2C3"
  text-muted: "#64748B"
  signal-cyan: "#06B6D4"
  sky-blue: "#0EA5E9"
  amethyst-signal: "#A78BFA"
  tx-green: "#10B981"
  success: "#22C55E"
  warning: "#F97316"
  danger: "#E24B4A"
  ring-track: "rgba(255, 255, 255, 0.08)"
  process-avatar-blue: "rgb(91, 141, 239)"
  process-avatar-violet: "rgb(139, 92, 246)"
  process-avatar-cyan: "rgb(34, 211, 238)"
  process-avatar-sky: "rgb(14, 165, 233)"
  process-avatar-green: "rgb(16, 185, 129)"
  process-avatar-blue-2: "rgb(59, 130, 246)"
  process-avatar-slate: "rgb(100, 116, 139)"
typography:
  display:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "14px"
  pill: "99px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  3xl: "20px"
  4xl: "24px"
  5xl: "32px"
components:
  summary-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  topbar-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.lg}"
    width: "36px"
    height: "36px"
  topbar-button-hover:
    backgroundColor: "{colors.surface-hover}"
  sidebar-nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  sidebar-nav-item-active:
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
  process-avatar:
    rounded: "{rounded.md}"
    width: "26px"
    height: "26px"
    typography: "{typography.body}"
---

# Design System: TrueNAS Dashboard

## Overview

**Creative North Star: "The Mission Control Panel"**

TrueNAS Dashboard is the dark-first, always-legible console for a home server: rings, sparklines, tables, and status dots read like instrumented gauges on a control-room wall, not a marketing surface. The mood is modern and vibrant rather than austere — Signal Cyan and Amethyst Signal give the flat dark surfaces real color and life, but they stay disciplined: each hue is tied to a specific channel of data (CPU/primary signal in cyan, RAM/inbound network in amethyst, outbound network and healthy states in green), never used decoratively. Nothing here is illustrative or aspirational; every visual element maps to a real, live number.

The system is currently mid-migration: this DESIGN.md documents the new sidebar+topbar UI (`index-updated.html` / `style-updated.css`), which is where active development (including the new Top Process Panel) is happening. The legacy UI (`index.html` / `style.css`) is being retired in its favor per the project roadmap.

**Key Characteristics:**
- Dark by default (`html[data-theme="dark"]`), with a fully-specified light theme as the alternate, not an afterthought.
- Flat everywhere — depth comes from tonal layering (background → surface → surface-hover), not shadows.
- One typeface (Figtree) for everything; hierarchy comes from size and weight, not font-mixing.
- Inline stroke-SVG icons throughout (Lucide-style, 24×24 viewBox, 2px stroke, round caps) — no icon fonts, no image icons.
- A tight, semantic set of state colors (success / warning / danger) applied consistently across disks, pools, and process rows.

## Colors

Flat, dark-first palette built around two "signal" accents against deep navy neutrals, with a small fixed set of semantic state colors.

### Primary
- **Signal Cyan** (`#06B6D4`): the primary telemetry signal — CPU ring progress, sparkline lines, active sidebar nav highlight, links, primary icon tint. Reserve it for the one "live/primary" element per screen; it is not a general decorative accent.
- **Sky Blue** (`#0EA5E9`): Signal Cyan's gradient partner — used in the sidebar wordmark gradient and the "accent-2" role wherever cyan needs a second stop.

### Secondary
- **Amethyst Signal** (`#A78BFA`): the system's second telemetry channel — RAM ring/sparkline and inbound (RX) network traffic share this hue deliberately, so a glance at color alone tells you which resource a chart is about.
- **Emerald Flow** (`#10B981`, `tx-green`): outbound (TX) network traffic. Paired visually with Amethyst Signal (RX) as the up/down direction pair on the network card.

### Neutral
- **Void** (`#0A0E1A` dark / `#F4F6FB` light): page background.
- **Surface** (`#111A2E` dark / `#F8FAFC` light): card and panel background.
- **Surface Hover** (`#1A2541` dark / `#F1F5F9` light): hover state for interactive rows, nav items, and buttons.
- **Border** (`rgba(255,255,255,0.08)` dark / `#E2E8F0` light): all card borders, dividers, and table rule lines.
- **Text** (`#E2E8F0` dark / `#0F172A` light): primary text.
- **Text Dim** (`#98A2C3` dark / `#475569` light): secondary text — table cell values, topbar icon default color.
- **Text Muted** (`#64748B`, same both themes): tertiary text — labels, placeholders, uppercase table headers.

### State Colors
- **Success** (`#22C55E` dark / `#10B981` light): healthy disk/pool status, "online" server dot (with a pulse-ring animation).
- **Warning** (`#F97316` dark / `#EA580C` light): elevated temperature, degraded-but-not-failed states.
- **Danger** (`#E24B4A`, same both themes): failed disk/pool, offline server status.

### Categorical (Process Avatars)
Seven fixed hues (`process-avatar-0` … `-6`: blue, violet, cyan, sky, green, blue-2, slate) assign a stable color identity per process-name initial in the Top Processes table, each rendered at 18% background tint with the full hue as text/icon color. This categorical set is independent of the semantic tokens above — it exists purely to make repeat processes visually recognizable at a glance.

### Observed inconsistency (flag for cleanup, not yet a rule)
`--accent-background` / `--accent-border` (used for the summary-card icon chip) are currently defined as an indigo `rgb(129,140,248)` tint rather than a Signal-Cyan-derived tint, in both themes. This reads as a leftover from an earlier accent color. Unify to a Signal Cyan tint next time that file is touched; don't propagate the indigo value into new components.

## Typography

**Display Font:** Figtree (weights 300–700, loaded from Google Fonts), with `-apple-system, BlinkMacSystemFont, system-ui, sans-serif` fallback.
**Character:** A single geometric-humanist sans carries the entire system — hierarchy is built with size and weight, never a second family, keeping every screen visually consistent with zero font-loading complexity.

### Hierarchy
- **Display** (700, 32px, 1.2): the hero number on a card — network throughput value, disk-overview aggregate stat. Reserved for the one number a card exists to show.
- **Headline** (700, 22px, 1.2, -0.01em): topbar page title; the in-ring metric value (CPU/RAM/temp percentage) at a slightly tighter size to fit inside the SVG ring.
- **Title** (700, 16–17px): summary card titles, sidebar wordmark.
- **Body** (500, 12–13px): table cell values, server-card rows, general UI text. (13px default body text is 400/regular where no weight is set.)
- **Label** (500, 10–11px, uppercase, 0.06–0.1em tracking): table column headers, sidebar version tag — always uppercase with wide tracking, never body-cased.

### Named Rules
**The Numeric Monospace Rule.** Disk names, temperatures, and percentages (`.disk-overview-name`, `.disk-overview-temp`, `.disk-overview-percent`) render in `monospace`, not Figtree — so columns of shifting numbers stay visually aligned instead of jittering as digit widths change.

## Layout

Two-region shell: a fixed-width 200px sidebar (collapsible to 84px, icon-only) plus a flexible main column with a 16px×24px topbar and a card grid below it. Below 768px the sidebar becomes an off-canvas drawer (`transform: translateX`) behind a blurred overlay rather than reflowing inline.

Summary cards lay out with `flex-wrap` at 4-up (`flex: 1 1 calc((100% - 48px) / 4)`), stepping to 2-up under 1200px and 1-up under 640px — flexbox handles the responsive reflow, not CSS grid, per project convention. Card gap is 16px throughout; internal card padding is 20px. Spacing steps in a tight 4px-based scale (4/6/8/10/12/16/20/24/32) rather than a looser 8pt system, which suits the information-dense table and row layouts.

## Elevation & Depth

Flat by rule. There is no box-shadow anywhere in the system except a single `pulse` keyframe (`box-shadow: 0 0 0 6px transparent → 0`) on the "online" server-status dot, which is a motion cue, not a resting elevation. Depth is conveyed entirely through tonal layering: `void` (page) → `surface` (card) → `surface-hover` (hovered row/button), plus 1px `border` hairlines to separate surfaces of similar tone.

### Named Rules
**The Flat-By-Design Rule.** Never add a resting box-shadow to a card, button, or row. If a component needs to read as "raised," lighten it one tonal step (surface → surface-hover) or add a border, not a shadow.

## Shapes

Radius scales with a component's size and role rather than one global value: small interactive chips and icon buttons sit around 8–10px, cards step up to 12px, pills (status badges, progress-bar tracks) go fully round at 99px, and avatars/status dots use true circles (50%). There are no square (0-radius) surfaces in the system — even the smallest icon container (4px, on tiny inline elements) keeps a soft corner.

## Components

### Buttons
Two button "families," both restrained: icon-only topbar buttons (36×36px, 10px radius, `surface` background, `border` outline, `text-dim` icon) and text-based sidebar nav items (10px radius, transparent at rest). Neither uses scale/bounce motion on interaction — feedback is a background/color shift only (`Tactile but restrained`).
- **Shape:** 10px radius on both families.
- **Topbar button:** `surface` background, 1px `border`, `text-dim` icon; hover shifts background to `surface-hover` only.
- **Sidebar nav item (default):** transparent background, `text-muted` label/icon.
- **Sidebar nav item (hover):** `surface` background, `text` label/icon.
- **Sidebar nav item (active):** a diagonal Signal-Cyan-to-Sky-Blue gradient wash at low opacity (18%→9%), a Signal-Cyan-tinted 35%-opacity border, and a 3px Signal Cyan bar on the left edge (`::before`) — the only place in the system a gradient fill appears on a UI surface (as opposed to text/wordmark).

### Cards / Containers (Summary Cards)
- **Corner Style:** 12px radius.
- **Background:** `surface`, 1px `border` outline — no shadow (see Elevation).
- **Internal Padding:** 20px, `min-height: 360px` so the 4-up grid stays visually even even when content length varies; collapses to `160px` min-height on mobile (640px and below).
- **Header:** icon chip (36×36px, 9px radius, `accent-background` tint — see the flagged inconsistency in Colors) + Title (16px/700) side by side.

### Tables (Processes, Pools)
- **Header row:** uppercase Label-style text (11px/500, `text-muted`, 0.06em tracking), bottom `border` rule, no background fill.
- **Body rows:** 13px `text-dim` values, bottom `border` rule between rows (removed on the last row), `surface-hover` background on `:hover`.
- **Process avatar:** 26×26px, 8px radius, one of the seven categorical hues at 18% tint — see Colors.
- **Progress/capacity bars** (pools, disks): track is `ring-track` at 6px height, 99px (pill) radius; fill uses the relevant state color (`success`/`warning`/`danger`) at full opacity, width transitions over 0.4s ease.

### Ring Charts (CPU / RAM / Temp)
Custom signature component: an SVG ring (110×110px, 8px stroke, round linecap) with the metric value (22px/700) and unit (14px/600) centered inside, label (13px) below. Ring color follows the `data-metric` attribute — cyan for load, amethyst for RAM, warning-orange for temp — reusing the exact same semantic mapping as the rest of the system rather than a separate chart palette.

### Navigation (Sidebar)
Icon + label items grouped with 4px gaps within a group and 16px between groups, separated by 1px dividers. Collapses to an 84px icon-only rail (labels fade via `opacity` + `width`, never `display:none`, so the collapse animates smoothly) rather than reflowing off-canvas — off-canvas is reserved for the sub-768px mobile breakpoint.

## Do's and Don'ts

### Do:
- **Do** drive every color and every repeated spacing/radius value through a CSS custom property — never hardcode a hex or px value that duplicates an existing token.
- **Do** build icons as inline stroke SVG (24×24 viewBox, 2px stroke, round linecap/linejoin) — matches every existing icon in the system.
- **Do** use `<button>`, never `<a>`, for in-app navigation and controls (sidebar nav, topbar actions).
- **Do** prefer flexbox for layout; reach for CSS grid only when flex genuinely can't express the layout.
- **Do** use semantic class names that describe the entity (`server-card-row`, `processes-table-row`), never the layout shape (`server-full-width`).
- **Do** keep Signal Cyan and Amethyst Signal tied to their specific data channels (primary/CPU and secondary/RAM+RX respectively) rather than using them interchangeably as generic accents.

### Don't:
- **Don't** add a resting `box-shadow` anywhere — the system is flat by rule; the pulse-ring on the online dot is the one motion exception, not a precedent for card elevation.
- **Don't** put ApexCharts (or any chart library) on a summary card — native SVG only there; ApexCharts is reserved for the dedicated detail pages (`cpu-apex.html` and its siblings).
- **Don't** build list markup with `innerHTML`; clone the existing `<template>` once and update only the values on refresh (disks, cores, pools, and process rows all follow this pattern).
- **Don't** introduce a second font family or a decorative display face — Figtree carries the whole hierarchy by size/weight alone.
