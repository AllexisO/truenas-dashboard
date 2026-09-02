# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are TrueNAS SCALE home-server operators — self-hosters running their own ZFS pools, Docker containers, and services on a home or homelab box — who self-host this dashboard on their own TrueNAS SCALE instance. The author is also a primary user (developed and run against a personal Ryzen 7 5700G / 64GB TrueNAS SCALE Fangtooth box), but the project is meant to work for other TrueNAS SCALE users deploying it on their own hardware, not just this one machine.

## Product Purpose

A real-time monitoring dashboard for a TrueNAS SCALE server: CPU, RAM, network, disks, ZFS pools, Docker containers, and top processes, refreshed continuously over WebSocket (~2s cadence). Success is confirming server health at a glance without opening multiple separate tools.

## Positioning

TrueNAS SCALE already ships its own reporting UI, and Netdata/Grafana cover deeper metrics — but checking server health today means visiting several separate places (TrueNAS UI, Dockge, Netdata). This dashboard's differentiator is a single unified real-time view that merges pools, disks, containers, and system health into one screen, backed by a lightweight Python bridge that reads directly off TrueNAS's own middleware socket (no separate exporter/agent stack to install alongside it).

## Operating Context

- Runs alongside TrueNAS SCALE (Fangtooth 25.04) and Docker containers managed via Dockge, deployed via Docker Compose, reached through a local `.local` domain served by AdGuard Home.
- No dominant viewing context: used across desktop browser tabs, mobile, and potentially wall/kiosk-style displays — none of these should be treated as the primary target at the expense of the others. (The in-progress adaptive mobile sidebar reflects this.)
- Developed live on the TrueNAS server itself via VS Code Remote SSH.

## Capabilities and Constraints

- Backend: Python 3.12-slim, `asyncio`/`aiohttp`/`websockets`, talking to TrueNAS middleware over a unix socket (DDP protocol) plus Netdata for history.
- Frontend: vanilla HTML/CSS/JS — no build step, no framework, no npm. ApexCharts only on detail pages; native SVG on summary cards.
- Each deployment is single-instance/single-server (one dashboard talks to the middleware socket of the box it runs on) — this is not a multi-tenant or multi-server product, closer in shape to a self-hosted Grafana than a SaaS.
- Config (`config.yml`) controls which widgets are enabled and is edited from the UI; no code changes needed to reconfigure a deployment.
- Currently mid-migration from the original UI (`index.html`/`style.css`) to a new sidebar+topbar UI (`index-updated.html`/`style-updated.css`) — both exist in the repo simultaneously until migration completes.

## Brand Commitments

- Name: "TrueNAS Dashboard". Repository: `AllexisO/truenas-dashboard`, MIT licensed, public on GitHub.
- Existing asset: `dashboard/icon.svg`.
- No further name, voice, or visual identity commitments confirmed yet.

## Evidence on Hand

None. No screenshots, testimonials, case studies, or press exist in the repository (README is a placeholder). Future work must not fabricate any of these.

## Product Principles

- One glance beats deep drill-down: surface health status immediately on the main screen; push detail (per-core, per-disk history) to secondary detail pages, not the first view.
- No separate agent/exporter to install: everything is read from data TrueNAS and Docker already expose locally, and that stays a constraint on new features.
- Zero build step: plain HTML/CSS/JS stays deployable by editing a file and hitting refresh — matches how this is actually developed and deployed.
- Built on the author's own server but shipped for other operators' servers: avoid hardcoding assumptions specific to one machine's hardware, pool layout, or interface names.
- No dominant viewing context: desktop, mobile, and a possible wall display are all real use cases; responsiveness is core, not a nice-to-have.
