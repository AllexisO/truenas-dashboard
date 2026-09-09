/**
 * topology-widget.js - System Topology Widget
 *
 * Hub-and-spoke SVG diagram (Server / CPU / RAM / Disks / Network / Internet)
 * for the Overview page. Built once from the first sufficiently complete
 * WebSocket payload, then only values are updated on every later message —
 * same "build once, update values" convention as the other widgets.
 */

(function () {
    var NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs) {
        var node = document.createElementNS(NS, tag);
        for (var key in attrs) node.setAttribute(key, attrs[key]);
        return node;
    }

    var SERVER_X = 480, SERVER_Y = 435, SERVER_R = 38, HUB_R = 28;
    var HUB_X_RIGHT = SERVER_X + 270, LEAF_X_RIGHT = HUB_X_RIGHT + HUB_R + 240, LEAF_W_RIGHT = 240;
    var HUB_X_LEFT = SERVER_X - 190;
    var GLOBE_X = HUB_X_LEFT - 200, GLOBE_R = HUB_R;
    var HUB_Y = { cpu: 220, ram: 499, disk: 650 };
    var LEAF_H = 22;

    var ICON_SERVER = '<rect x="2" y="14" width="20" height="7" rx="1.5"/><rect x="6" y="3" width="12" height="7" rx="1.5"/><path d="M9 10v4M15 10v4"/><circle cx="6.5" cy="17.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="6.5" cy="6.5" r="0.6" fill="currentColor" stroke="none"/>';
    var ICON_CPU = '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>';
    var ICON_RAM = '<rect x="2" y="8" width="20" height="9" rx="1"/><path d="M6 12v2M10 12v2M14 12v2M18 12v2"/>';
    var ICON_NET = '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>';
    var ICON_DISK = '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>';
    var ICON_GLOBE = '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>';

    // Per-disk identity color so a line can be traced to its disk even where
    // several cross near the hub. Cycles if there are ever more disks than
    // colors — works for any disk count, not just a specific server's.
    var DISK_PALETTE = ["#F472B6", "#E879F9", "#818CF8", "#FACC15", "#A3E635", "#A5B4FC", "#FDA4AF"];
    function diskColor(i) { return DISK_PALETTE[i % DISK_PALETTE.length]; }

    // Shared by build and update: which color/load the Disks hub<->server
    // spine should currently borrow from DISK.dominantRead/Write (-1 = no
    // disk is meaningfully active on that side right now).
    function dominantDiskColor(DISK, index) {
        if (index < 0) return "var(--text-dim)";
        var d = DISK.disks[index];
        return d.warn ? "var(--warning)" : diskColor(index);
    }
    function dominantDiskLoad(DISK, index, field) {
        return index < 0 ? 0 : DISK.disks[index][field];
    }

    // Color = load, continuously — accent cyan at 0%, warning orange at 90%+.
    // Interpolated by hue (not raw RGB) so it sweeps cyan -> green/yellow ->
    // orange instead of crossing a muddy grey/purple midpoint.
    function loadColor(pct) {
        var t = Math.max(0, Math.min(1, pct / 90));
        var te = t * t * t;
        var h = 189 + (25 - 189) * te;
        return "hsl(" + h.toFixed(0) + ",82%,50%)";
    }

    function durFor(loadPct) {
        var f = Math.max(0, Math.min(1, loadPct / 100));
        return Math.max(0.5, 3.6 - 3.0 * f);
    }

    // A dot that keeps crawling forever, even at the slowest speed, reads as
    // "this is always doing something" — genuinely idle (~0%) should show no
    // pulse at all, not just a slow one.
    function pulseOpacityFor(loadPct) {
        if (loadPct < 2) return 0;
        return Math.max(0.4, Math.min(1, loadPct / 30));
    }

    function bezierH(x1, y1, x2, y2) {
        var cx = x1 + (x2 - x1) * 0.5;
        return "M" + x1 + "," + y1 + " C" + cx + "," + y1 + " " + cx + "," + y2 + " " + x2 + "," + y2;
    }

    // A small circle+exclamation badge — the "!" cutout is punched from
    // --surface, not a separate color, so it reads in grayscale/colorblind
    // simulation too: warn is never carried by hue alone anywhere here.
    function warnBadge(cx, cy) {
        var b = el("g", { "aria-hidden": "true" });
        b.appendChild(el("circle", { cx: cx, cy: cy, r: 6, fill: "var(--warning)", stroke: "var(--surface)", "stroke-width": 1.5 }));
        b.appendChild(el("rect", { x: cx - 0.75, y: cy - 3.2, width: 1.5, height: 3.4, rx: 0.75, fill: "var(--surface)" }));
        b.appendChild(el("circle", { cx: cx, cy: cy + 2.1, r: 0.85, fill: "var(--surface)" }));
        return b;
    }

    // A wire's traveling dot. Data arrives roughly every 2s, but the dot has
    // to keep moving smoothly between those ticks — so position is driven by
    // a single shared requestAnimationFrame loop (see startPulseLoop below),
    // not by re-triggering an animation on every WebSocket message. Changing
    // speed only ever adjusts `wire.durationMs`; it never resets `progress`,
    // so the dot's current position carries over instead of jumping back to
    // the start of the path.
    var allWires = [];

    function makeWire(d, color, loadPct) {
        var g = el("g", {});
        var pathEl = el("path", { d: d, class: "tp-branch", stroke: color });
        g.appendChild(pathEl);
        var initialOpacity = pulseOpacityFor(loadPct);
        var dot = el("circle", { r: 3.2, fill: color, class: "tp-pulse", opacity: initialOpacity });
        g.appendChild(dot);

        var wire = {
            g: g, dot: dot, pathEl: pathEl, length: 0.001, durationMs: durFor(loadPct) * 1000, progress: 0,
            opacity: initialOpacity, targetOpacity: initialOpacity
        };
        allWires.push(wire);
        return wire;
    }

    // getTotalLength()/getPointAtLength() are geometry-only, but are called
    // only once the <path> is actually attached to the document to avoid
    // relying on any engine's behavior for detached SVG nodes.
    function finalizeWireGeometry(wire) {
        wire.length = wire.pathEl.getTotalLength() || 0.001;
        var start = wire.pathEl.getPointAtLength(0);
        wire.dot.setAttribute("cx", start.x);
        wire.dot.setAttribute("cy", start.y);
    }

    // Real per-2s read/write samples are genuinely bursty (ZFS batches
    // writes into the ARC and flushes to disk on its own ~5s cadence, not
    // every poll tick), so the true instantaneous rate really does swing
    // between "busy" and "zero" between consecutive samples. Snapping
    // opacity straight to that value made a dot vanish mid-flight the
    // instant a quiet sample landed. Only the *target* changes here — the
    // render loop below eases the visible opacity toward it, so a single
    // quiet sample fades the dot out instead of cutting it off.
    function setWireLoad(wire, loadPct) {
        wire.durationMs = durFor(loadPct) * 1000;
        wire.targetOpacity = pulseOpacityFor(loadPct);
    }

    // Only the shared Disks hub<->server spine needs its color to change
    // after the initial build — which disk is "loudest" shifts tick to tick,
    // and the spine should visibly trace whichever one that currently is.
    function setWireColor(wire, color) {
        wire.pathEl.setAttribute("stroke", color);
        wire.dot.setAttribute("fill", color);
    }

    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var pulseLoopStarted = false;
    var lastFrameTime = null;
    // Time constant for opacity easing — comfortably under the ~2s poll
    // interval so it still settles at the real value between updates,
    // but slow enough that a single quiet sample reads as a fade, not a cut.
    var OPACITY_EASE_MS = 700;

    function pulseFrame(timestamp) {
        if (lastFrameTime == null) lastFrameTime = timestamp;
        var dt = timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        for (var i = 0; i < allWires.length; i++) {
            var wire = allWires[i];
            wire.progress = (wire.progress + dt / wire.durationMs) % 1;
            var point = wire.pathEl.getPointAtLength(wire.progress * wire.length);
            wire.dot.setAttribute("cx", point.x);
            wire.dot.setAttribute("cy", point.y);

            wire.opacity += (wire.targetOpacity - wire.opacity) * Math.min(1, dt / OPACITY_EASE_MS);
            wire.dot.setAttribute("opacity", wire.opacity.toFixed(2));
        }

        requestAnimationFrame(pulseFrame);
    }

    function startPulseLoop() {
        if (pulseLoopStarted || reducedMotion) return;
        pulseLoopStarted = true;
        requestAnimationFrame(pulseFrame);
    }

    function hub(cx, cy, iconMarkup, loadPct, title, subtitle, color, warn, radius, alive) {
        var r = radius || HUB_R;
        var g = el("g", {
            role: "img", tabindex: "0", class: "tp-focusable",
            "aria-label": title + " — " + subtitle + (warn ? " — needs attention" : "")
        });
        var titleEl = el("title", {});
        titleEl.textContent = title + " — " + subtitle + (warn ? " — needs attention" : "");
        g.appendChild(titleEl);

        var frac = Math.max(0, Math.min(1, loadPct / 100));
        var circumference = 2 * Math.PI * r;

        g.appendChild(el("circle", { cx: cx, cy: cy, r: r, class: "tp-hub-core", stroke: "var(--border)", "stroke-width": 1 }));
        // The Server hub's ring always reads 100% (it's not a %-metric like
        // CPU/RAM), so unlike every other hub it never visibly changes — a
        // slow radiating "radar ping" behind it signals the same thing
        // .server-status-dot.online does elsewhere in this dashboard: the
        // server is live and reporting, not any particular measured value.
        var pingRing = null;
        if (alive) {
            pingRing = el("circle", { cx: cx, cy: cy, r: r, class: "tp-server-ping", stroke: warn ? "var(--warning)" : "var(--success)" });
            g.appendChild(pingRing);
        }
        g.appendChild(el("circle", { cx: cx, cy: cy, r: r, class: "tp-hub-ring-track" }));
        var ring = el("circle", {
            cx: cx, cy: cy, r: r, class: "tp-hub-ring", stroke: warn ? "var(--warning)" : color, "stroke-width": 5,
            "stroke-dasharray": circumference.toFixed(1), "stroke-dashoffset": (circumference * (1 - frac)).toFixed(1),
            transform: "rotate(-90 " + cx + " " + cy + ")"
        });
        g.appendChild(ring);

        var iconSize = r * 0.55;
        var icon = el("g", {
            transform: "translate(" + (cx - iconSize / 2) + "," + (cy - iconSize / 2) + ") scale(" + (iconSize / 24) + ")",
            fill: "none", stroke: "currentColor", "stroke-width": (24 / iconSize) * 2,
            "stroke-linecap": "round", "stroke-linejoin": "round", style: "color:var(--text)"
        });
        icon.innerHTML = iconMarkup;
        g.appendChild(icon);

        var label = el("text", { x: cx, y: cy + r + 18, "text-anchor": "middle", class: "tp-node-label" });
        label.textContent = title;
        g.appendChild(label);

        var sub = el("text", { x: cx, y: cy + r + 32, "text-anchor": "middle", class: "tp-node-sub" });
        sub.textContent = subtitle;
        g.appendChild(sub);

        var badge = warn ? warnBadge(cx + r * 0.74, cy - r * 0.74) : null;
        if (badge) g.appendChild(badge);

        return { g: g, titleEl: titleEl, title: title, ring: ring, pingRing: pingRing, sub: sub, circumference: circumference, r: r, color: color, badge: badge, cx: cx, cy: cy };
    }

    function setHubLoad(hubRef, loadPct, warn, subtitle) {
        var frac = Math.max(0, Math.min(1, loadPct / 100));
        hubRef.ring.setAttribute("stroke-dashoffset", (hubRef.circumference * (1 - frac)).toFixed(1));
        hubRef.ring.setAttribute("stroke", warn ? "var(--warning)" : hubRef.color);
        if (hubRef.pingRing) hubRef.pingRing.setAttribute("stroke", warn ? "var(--warning)" : "var(--success)");
        if (subtitle != null) hubRef.sub.textContent = subtitle;
        hubRef.titleEl.textContent = hubRef.title + " — " + (subtitle != null ? subtitle : "") + (warn ? " — needs attention" : "");
        hubRef.g.setAttribute("aria-label", hubRef.titleEl.textContent);

        if (warn && !hubRef.badge) {
            hubRef.badge = warnBadge(hubRef.cx + hubRef.r * 0.74, hubRef.cy - hubRef.r * 0.74);
            hubRef.g.appendChild(hubRef.badge);
        } else if (!warn && hubRef.badge) {
            hubRef.badge.remove();
            hubRef.badge = null;
        }
    }

    function leaf(x, y, label, value, color, loadPct, warn, width) {
        var w = width || LEAF_W_RIGHT;
        var g = el("g", {
            role: "img", tabindex: "0", class: "tp-focusable",
            "aria-label": label + " — " + value + (warn ? " — needs attention" : "")
        });
        var titleEl = el("title", {});
        titleEl.textContent = label + " — " + value + (warn ? " — needs attention" : "");
        g.appendChild(titleEl);

        var pill = el("rect", { x: x, y: y - LEAF_H / 2, width: w, height: LEAF_H, rx: 6, class: "tp-leaf-pill" + (warn ? " is-warning" : "") });
        g.appendChild(pill);

        var bar = null, barMaxW = w - 16;
        if (typeof loadPct === "number") {
            g.appendChild(el("rect", { x: x + 8, y: y + LEAF_H / 2 - 4.5, width: barMaxW, height: 2.5, rx: 1.25, fill: "var(--ring-track)" }));
            var barW = barMaxW * Math.max(0.02, loadPct / 100);
            bar = el("rect", { x: x + 8, y: y + LEAF_H / 2 - 4.5, width: barW.toFixed(1), height: 2.5, rx: 1.25, fill: warn ? "var(--warning)" : color });
            g.appendChild(bar);
        }

        var textY = y - 2;
        var lbl = el("text", { x: x + 11, y: textY, "dominant-baseline": "middle", class: "tp-leaf-label" });
        lbl.textContent = label;
        g.appendChild(lbl);

        var val = el("text", { x: x + w - 11, y: textY, "text-anchor": "end", "dominant-baseline": "middle", class: "tp-leaf-value", fill: warn ? "var(--warning)" : "var(--text)" });
        val.textContent = value;
        g.appendChild(val);

        var badge = warn ? warnBadge(x + w, y - LEAF_H / 2) : null;
        if (badge) g.appendChild(badge);

        return { g: g, titleEl: titleEl, label: label, pill: pill, bar: bar, barMaxW: barMaxW, val: val, x: x, y: y, w: w, color: color, badge: badge };
    }

    function setLeafLoad(leafRef, value, loadPct, warn, color) {
        leafRef.val.textContent = value;
        leafRef.val.setAttribute("fill", warn ? "var(--warning)" : "var(--text)");
        leafRef.titleEl.textContent = leafRef.label + " — " + value + (warn ? " — needs attention" : "");
        leafRef.g.setAttribute("aria-label", leafRef.titleEl.textContent);
        leafRef.pill.classList.toggle("is-warning", !!warn);

        if (leafRef.bar && typeof loadPct === "number") {
            var barW = leafRef.barMaxW * Math.max(0.02, loadPct / 100);
            leafRef.bar.setAttribute("width", barW.toFixed(1));
            leafRef.bar.setAttribute("fill", warn ? "var(--warning)" : color);
        }

        if (warn && !leafRef.badge) {
            leafRef.badge = warnBadge(leafRef.x + leafRef.w, leafRef.y - LEAF_H / 2);
            leafRef.g.appendChild(leafRef.badge);
        } else if (!warn && leafRef.badge) {
            leafRef.badge.remove();
            leafRef.badge = null;
        }
    }

    function leafYs(center, n, pitch) {
        var start = center - ((n - 1) / 2) * pitch;
        var ys = [];
        for (var i = 0; i < n; i++) ys.push(start + i * pitch);
        return ys;
    }

    // ---- data.* -> diagram model -------------------------------------

    function deriveModel(data) {
        var cpuRealtime = data.realtime && data.realtime.cpu;
        var memory = data.realtime && data.realtime.memory;
        var interfaces = data.realtime && data.realtime.interfaces;

        if (!cpuRealtime || !cpuRealtime.cpu || !memory || !data.disks || !data.disks.length || !data.pools || !data.system) return null;

        var coreKeys = Object.keys(cpuRealtime).filter(function (key) { return key !== "cpu"; });
        coreKeys.sort(function (a, b) { return parseInt(a.replace("cpu", ""), 10) - parseInt(b.replace("cpu", ""), 10); });
        if (!coreKeys.length) return null;

        var cpuTemp = Math.round(cpuRealtime.cpu.temp || 0);
        var cores = coreKeys.map(function (key, i) {
            var load = cpuRealtime[key].usage || 0;
            return { label: "Core " + i, value: Math.round(load) + "%", load: load, warn: load >= 90 };
        });
        var CPU = { load: cpuRealtime.cpu.usage || 0, temp: cpuTemp, cores: cores };

        var total = memory.physical_memory_total || 0;
        var available = memory.physical_memory_available || 0;
        var used = total - available;
        var ramLoad = total ? (used / total) * 100 : 0;
        // A board can report the same slot locator for two different physical
        // sticks (e.g. "DIMM 0" reused per channel) — guard against showing
        // two identical-looking leaves by disambiguating on the fly.
        var seenSlotLabels = {};
        var sticks = (data.memory_info || []).map(function (module, i) {
            var label = module.slot || ("DIMM " + i);
            if (seenSlotLabels[label] != null) {
                seenSlotLabels[label] += 1;
                label = label + " (" + seenSlotLabels[label] + ")";
            } else {
                seenSlotLabels[label] = 1;
            }
            return { label: label, size: module.size || "", speed: module.speed || "" };
        });
        var RAM = { load: ramLoad, arc: formatBytes(memory.arc_size || 0), sticks: sticks };

        var ifaceName = interfaces ? Object.keys(interfaces)[0] : null;
        var iface = ifaceName ? interfaces[ifaceName] : null;
        // `iface.speed` isn't reliably populated for every interface type, so
        // (like header.js's LED brightness calc) load% is scaled against a
        // fixed 1 GbE reference rather than a field that can silently be 0 —
        // otherwise every rate reads as 0% and every pulse falls back to the
        // same idle speed, which looks like RX/TX aren't moving at all.
        var NET_REFERENCE_BYTES_PER_SEC = (1000 * 1024 * 1024) / 8;
        function rateLoad(bytesPerSecond) {
            return Math.max(0, Math.min(100, (bytesPerSecond / NET_REFERENCE_BYTES_PER_SEC) * 100));
        }
        // The ring's load% is (rightly) judged against link capacity above,
        // but real home traffic rarely nears that ceiling — a few hundred
        // KB/s reads as <1% of 1 GbE, which pulseOpacityFor's "idle, show
        // nothing" cutoff then renders as a permanently invisible dot on the
        // Internet<->Network<->Server wires. Wire *activity* is judged on its
        // own log scale of the raw bytes/sec instead, so real-but-modest
        // traffic still pulses, and only genuinely idle (near-zero) shows none.
        var NET_PULSE_FLOOR_BYTES = 1024, NET_PULSE_CEIL_BYTES = 10 * 1024 * 1024;
        function pulseLoad(bytesPerSecond) {
            if (bytesPerSecond < NET_PULSE_FLOOR_BYTES) return 0;
            var t = Math.log(bytesPerSecond / NET_PULSE_FLOOR_BYTES) / Math.log(NET_PULSE_CEIL_BYTES / NET_PULSE_FLOOR_BYTES);
            return Math.max(0, Math.min(100, t * 100));
        }
        var rxBytes = (iface && iface.received_bytes_rate) || 0;
        var txBytes = (iface && iface.sent_bytes_rate) || 0;
        var rxFormatted = formatNetworkSpeed(rxBytes);
        var txFormatted = formatNetworkSpeed(txBytes);
        var NET = {
            online: iface ? iface.link_state === "LINK_STATE_UP" : false,
            rx: { value: rxFormatted.value + " " + rxFormatted.unit, load: rateLoad(rxBytes), pulse: pulseLoad(rxBytes) },
            tx: { value: txFormatted.value + " " + txFormatted.unit, load: rateLoad(txBytes), pulse: pulseLoad(txBytes) }
        };

        // Per-disk wire speed uses `disk_io`, the bridge's own
        // delta-of-/proc/diskstats computation (poller.py's update_disk_io)
        // — real, distinct per disk, rather than every disk sharing one
        // aggregate signal.
        var diskPoolMap = buildDiskPoolMap(data.pools);
        var diskIo = data.disk_io || {};
        // Same problem as NET's pulse above: a flat percent-of-max reference
        // makes ordinary disk activity (a browser writing a downloaded file,
        // a container doing light I/O) read as near-0% and never pulse. Wire
        // activity is judged on its own log scale of the raw bytes/sec, with
        // a low floor so real-but-modest I/O still shows a pulse and only
        // genuine idle (near-zero) shows none. Not a claimed per-model max —
        // this server mixes SATA SSDs and spinning HDDs with very different
        // real ceilings, so the ceiling just needs "fast" to look fast.
        var DISK_PULSE_FLOOR_BYTES = 32 * 1024, DISK_PULSE_CEIL_BYTES = 120 * 1024 * 1024;
        function diskRateLoad(bytesPerSecond) {
            if (bytesPerSecond < DISK_PULSE_FLOOR_BYTES) return 0;
            var t = Math.log(bytesPerSecond / DISK_PULSE_FLOOR_BYTES) / Math.log(DISK_PULSE_CEIL_BYTES / DISK_PULSE_FLOOR_BYTES);
            return Math.max(0, Math.min(100, t * 100));
        }

        var disks = data.disks.map(function (disk) {
            var pool = diskPoolMap[disk.name];
            var isBootDisk = data.boot_disks && data.boot_disks.indexOf(disk.name) !== -1;
            var usedPct = 0, warn = false, poolName = "unassigned";

            if (pool) {
                usedPct = pool.size ? Math.round((pool.allocated / pool.size) * 100) : 0;
                warn = !pool.healthy || !!pool.warning;
                poolName = pool.name;
            } else if (isBootDisk && data.boot_disk) {
                usedPct = data.boot_disk.total ? Math.round((data.boot_disk.used / data.boot_disk.total) * 100) : 0;
                poolName = "boot-pool";
            }

            var temp = data.disk_temps ? data.disk_temps[disk.name] : undefined;
            var io = diskIo[disk.name] || {};
            return {
                name: disk.name, pool: poolName, used: usedPct, temp: temp, warn: warn,
                readLoad: diskRateLoad(io.read_bytes_rate || 0),
                writeLoad: diskRateLoad(io.write_bytes_rate || 0)
            };
        });

        var avgUsed = disks.length ? Math.round(disks.reduce(function (sum, d) { return sum + d.used; }, 0) / disks.length) : 0;

        // Which disk to trace the shared hub<->server spine through: real per-disk
        // I/O already exists at the leaf<->hub leg (readLoad/writeLoad above), so
        // reuse it here rather than inventing a second "which disk is busiest"
        // signal — pick the single loudest one per direction, so a download that's
        // clearly hitting sdc reads as "server -> [sdc's color] -> hub -> sdc",
        // not a color average across every disk. Ties and all-idle both fall back
        // to no dominant disk (spine stays neutral, matching genuinely idle I/O).
        function dominantDiskIndex(field) {
            var bestIndex = -1, bestLoad = 0;
            disks.forEach(function (d, i) {
                if (d[field] > bestLoad) { bestLoad = d[field]; bestIndex = i; }
            });
            return bestIndex;
        }
        var dominantRead = dominantDiskIndex("readLoad");
        var dominantWrite = dominantDiskIndex("writeLoad");

        var DISK = {
            disks: disks, avgUsed: avgUsed, activeCount: disks.length,
            dominantRead: dominantRead, dominantWrite: dominantWrite
        };

        var SERVER = {
            // A fixed, descriptive label like every other hub (CPU/RAM/Disks/
            // Network/Internet) rather than the raw hostname — this node
            // means "the TrueNAS box," not "whatever it happens to be named."
            name: "TrueNAS Server",
            uptime: data.system.uptime ? formatUptime(data.system.uptime) : "",
            warn: disks.some(function (d) { return d.warn; })
        };

        return { SERVER: SERVER, CPU: CPU, RAM: RAM, NET: NET, DISK: DISK };
    }

    // ---- build (once) / update (every later tick) ----------------------

    var state = { built: false, refs: null };

    function subtitleFor(model) {
        return {
            server: model.SERVER.uptime ? "uptime " + model.SERVER.uptime : "",
            cpu: Math.round(model.CPU.load) + "% · " + model.CPU.temp + "°C",
            ram: Math.round(model.RAM.load) + "% · ARC " + model.RAM.arc,
            disk: model.DISK.activeCount + " disks · avg " + model.DISK.avgUsed + "% used",
            net: "↓" + model.NET.rx.value + " ↑" + model.NET.tx.value
        };
    }

    function buildDiagram(model) {
        var svg = document.getElementById("tp-svg");
        if (!svg) return;

        var CPU = model.CPU, RAM = model.RAM, NET = model.NET, DISK = model.DISK, SERVER = model.SERVER;
        var sub = subtitleFor(model);

        var CPU_YS = leafYs(HUB_Y.cpu, CPU.cores.length, 24);
        var RAM_YS = leafYs(HUB_Y.ram, Math.max(RAM.sticks.length, 1), 26);
        var DISK_YS = leafYs(HUB_Y.disk, DISK.disks.length, 24);

        var serverLeftX = SERVER_X - SERVER_R, serverRightX = SERVER_X + SERVER_R;
        var hubLeftEdgeRight = HUB_X_RIGHT - HUB_R, hubEdgeXRight = HUB_X_RIGHT + HUB_R;
        var hubLeftEdgeLeft = HUB_X_LEFT - HUB_R, hubRightEdgeLeft = HUB_X_LEFT + HUB_R;
        var globeRightEdge = GLOBE_X + GLOBE_R;

        var refs = { cpuLeaves: [], ramLeaves: [], diskLeaves: [], diskLeafWires: [], cpuWires: [] };

        function addWire(d, color, loadPct) {
            var wire = makeWire(d, color, loadPct);
            svg.appendChild(wire.g);
            finalizeWireGeometry(wire);
            return wire;
        }

        // Telemetry flows the way you'd expect a heartbeat to: leaf reports up
        // to its hub, hub reports up to the server.
        refs.cpuHubWire = addWire(bezierH(hubLeftEdgeRight, HUB_Y.cpu, serverRightX, SERVER_Y), "var(--accent)", CPU.load);
        refs.ramHubWire = addWire(bezierH(hubLeftEdgeRight, HUB_Y.ram, serverRightX, SERVER_Y), "var(--ram-color)", RAM.load);

        // Disks hub -> server is one consolidated spine, same as CPU/RAM above
        // — a separate hub->server line per disk would all share this one
        // hub's single anchor point, so they'd draw as the exact same curve
        // stacked on top of each other regardless of any color difference.
        // Instead the spine borrows the color and real read/write rate of
        // whichever disk is currently loudest (DISK.dominantRead/Write, from
        // the same per-disk data the leaf<->hub legs use below) — so a
        // download landing on sdc traces as server -> [sdc's color] -> hub ->
        // sdc, the whole way. No disk active on that side yet: stays neutral.
        refs.diskHubReadWire = addWire(bezierH(hubLeftEdgeRight, HUB_Y.disk, serverRightX, SERVER_Y), dominantDiskColor(DISK, DISK.dominantRead), dominantDiskLoad(DISK, DISK.dominantRead, "readLoad"));
        refs.diskHubWriteWire = addWire(bezierH(serverRightX, SERVER_Y, hubLeftEdgeRight, HUB_Y.disk), dominantDiskColor(DISK, DISK.dominantWrite), dominantDiskLoad(DISK, DISK.dominantWrite, "writeLoad"));

        CPU.cores.forEach(function (core, i) {
            refs.cpuWires.push(addWire(bezierH(LEAF_X_RIGHT, CPU_YS[i], hubEdgeXRight, HUB_Y.cpu), loadColor(core.load), core.load));
        });
        RAM.sticks.forEach(function (s, i) {
            addWire(bezierH(LEAF_X_RIGHT, RAM_YS[i], hubEdgeXRight, HUB_Y.ram), "var(--ram-color)", RAM.load);
        });
        // Each disk's own leaf position (DISK_YS[i]) already keeps its
        // leaf<->hub wire visually distinct from every other disk's, so this
        // leg — unlike hub<->server above — genuinely carries per-disk
        // identity and per-disk real read/write speed.
        DISK.disks.forEach(function (d, i) {
            var color = d.warn ? "var(--warning)" : diskColor(i);
            var readWire = addWire(bezierH(LEAF_X_RIGHT, DISK_YS[i], hubEdgeXRight, HUB_Y.disk), color, d.readLoad);
            var writeWire = addWire(bezierH(hubEdgeXRight, HUB_Y.disk, LEAF_X_RIGHT, DISK_YS[i]), color, d.writeLoad);
            refs.diskLeafWires.push({ read: readWire, write: writeWire });
        });

        // World <-> Network <-> Server: one duplex "wire" per hop, two dots
        // riding the same path in opposite directions (RX inbound / TX outbound).
        refs.rxWireOuter = addWire(bezierH(globeRightEdge, SERVER_Y, hubLeftEdgeLeft, SERVER_Y), "var(--rx-network-color)", NET.rx.pulse);
        refs.txWireOuter = addWire(bezierH(hubLeftEdgeLeft, SERVER_Y, globeRightEdge, SERVER_Y), "var(--tx-network-color)", NET.tx.pulse);
        refs.rxWireInner = addWire(bezierH(hubRightEdgeLeft, SERVER_Y, serverLeftX, SERVER_Y), "var(--rx-network-color)", NET.rx.pulse);
        refs.txWireInner = addWire(bezierH(serverLeftX, SERVER_Y, hubRightEdgeLeft, SERVER_Y), "var(--tx-network-color)", NET.tx.pulse);

        refs.serverHub = hub(SERVER_X, SERVER_Y, ICON_SERVER, 100, SERVER.name, sub.server, "var(--success)", SERVER.warn, SERVER_R, true);
        svg.appendChild(refs.serverHub.g);

        refs.cpuHub = hub(HUB_X_RIGHT, HUB_Y.cpu, ICON_CPU, CPU.load, "CPU", sub.cpu, "var(--accent)", false);
        svg.appendChild(refs.cpuHub.g);

        refs.ramHub = hub(HUB_X_RIGHT, HUB_Y.ram, ICON_RAM, RAM.load, "RAM", sub.ram, "var(--ram-color)", false);
        svg.appendChild(refs.ramHub.g);

        var diskWarn = DISK.disks.some(function (d) { return d.warn; });
        // Disks don't own a single telemetry hue the way CPU/RAM do — their
        // real per-disk identity already lives in DISK_PALETTE at the leaf
        // level, so the hub stays neutral like Server/Internet.
        refs.diskHub = hub(HUB_X_RIGHT, HUB_Y.disk, ICON_DISK, DISK.avgUsed, "Disks", sub.disk, "var(--text-dim)", diskWarn);
        svg.appendChild(refs.diskHub.g);

        var netAvgLoad = (NET.rx.load + NET.tx.load) / 2;
        refs.netHub = hub(HUB_X_LEFT, SERVER_Y, ICON_NET, netAvgLoad, "Network", sub.net, "var(--tx-network-color)", !NET.online);
        svg.appendChild(refs.netHub.g);

        refs.globeHub = hub(GLOBE_X, SERVER_Y, ICON_GLOBE, netAvgLoad, "Internet", "", "var(--text-dim)", false, GLOBE_R);
        svg.appendChild(refs.globeHub.g);

        // "pkg" temp, not a per-core one — most desktop/server CPUs expose one
        // package-wide sensor, not one per core, so per-core numbers would be made up.
        CPU.cores.forEach(function (core, i) {
            var leafRef = leaf(LEAF_X_RIGHT, CPU_YS[i], core.label, core.value + " · pkg " + CPU.temp + "°C", loadColor(core.load), core.load, core.warn);
            svg.appendChild(leafRef.g);
            refs.cpuLeaves.push(leafRef);
        });
        RAM.sticks.forEach(function (s, i) {
            var leafRef = leaf(LEAF_X_RIGHT, RAM_YS[i], s.label, (s.size ? s.size + " · " : "") + s.speed, "var(--ram-color)", null, false);
            svg.appendChild(leafRef.g);
            refs.ramLeaves.push(leafRef);
        });
        DISK.disks.forEach(function (d, i) {
            var value = d.pool + " · " + d.used + "% used" + (d.temp != null ? " · " + Math.round(d.temp) + "°C" : "");
            var leafRef = leaf(LEAF_X_RIGHT, DISK_YS[i], d.name, value, diskColor(i), d.used, d.warn);
            svg.appendChild(leafRef.g);
            refs.diskLeaves.push(leafRef);
        });

        state.built = true;
        state.refs = refs;
        startPulseLoop();
    }

    function updateDiagram(model) {
        var refs = state.refs;
        var CPU = model.CPU, RAM = model.RAM, NET = model.NET, DISK = model.DISK;
        var sub = subtitleFor(model);

        setHubLoad(refs.serverHub, 100, model.SERVER.warn, sub.server);
        setHubLoad(refs.cpuHub, CPU.load, false, sub.cpu);
        setHubLoad(refs.ramHub, RAM.load, false, sub.ram);
        var diskWarn = DISK.disks.some(function (d) { return d.warn; });
        setHubLoad(refs.diskHub, DISK.avgUsed, diskWarn, sub.disk);
        var netAvgLoad = (NET.rx.load + NET.tx.load) / 2;
        setHubLoad(refs.netHub, netAvgLoad, !NET.online, sub.net);
        setHubLoad(refs.globeHub, netAvgLoad, false, null);

        setWireLoad(refs.cpuHubWire, CPU.load);
        setWireLoad(refs.ramHubWire, RAM.load);
        setWireLoad(refs.rxWireOuter, NET.rx.pulse);
        setWireLoad(refs.txWireOuter, NET.tx.pulse);
        setWireLoad(refs.rxWireInner, NET.rx.pulse);
        setWireLoad(refs.txWireInner, NET.tx.pulse);

        setWireColor(refs.diskHubReadWire, dominantDiskColor(DISK, DISK.dominantRead));
        setWireLoad(refs.diskHubReadWire, dominantDiskLoad(DISK, DISK.dominantRead, "readLoad"));
        setWireColor(refs.diskHubWriteWire, dominantDiskColor(DISK, DISK.dominantWrite));
        setWireLoad(refs.diskHubWriteWire, dominantDiskLoad(DISK, DISK.dominantWrite, "writeLoad"));

        DISK.disks.forEach(function (d, i) {
            var wires = refs.diskLeafWires[i];
            if (!wires) return;
            setWireLoad(wires.read, d.readLoad);
            setWireLoad(wires.write, d.writeLoad);
        });

        CPU.cores.forEach(function (core, i) {
            var wire = refs.cpuWires[i];
            if (wire) setWireLoad(wire, core.load);

            var leafRef = refs.cpuLeaves[i];
            if (leafRef) setLeafLoad(leafRef, core.value + " · pkg " + CPU.temp + "°C", core.load, core.warn, loadColor(core.load));
        });

        DISK.disks.forEach(function (d, i) {
            var leafRef = refs.diskLeaves[i];
            if (!leafRef) return;
            var value = d.pool + " · " + d.used + "% used" + (d.temp != null ? " · " + Math.round(d.temp) + "°C" : "");
            setLeafLoad(leafRef, value, d.used, d.warn, diskColor(i));
        });
    }

    function updateTopology(data) {
        if (!data) return;
        if (!document.getElementById("topology-canvas")) return;

        var model = deriveModel(data);
        if (!model) return;

        if (!state.built) {
            buildDiagram(model);
        } else {
            updateDiagram(model);
        }
    }

    window.updateTopology = updateTopology;

    // ---- drag-to-pan (mouse + touch via Pointer Events) + zoom --------

    // Persists the height the user drags .topology-canvas's native resize
    // handle to, the same "remember it in localStorage" convention the
    // theme and sidebar-collapsed state already use elsewhere. Scoped to
    // desktop widths only — below the mobile breakpoint (style-updated.css's
    // own 640px media query) the canvas height is fixed by CSS, not the
    // user, so a ResizeObserver firing there is that breakpoint switching,
    // not a real resize, and must not overwrite the saved desktop height.
    var TOPOLOGY_HEIGHT_KEY = "topologyCanvasHeight";
    var TOPOLOGY_MIN_HEIGHT = 465, TOPOLOGY_MAX_HEIGHT = 900, TOPOLOGY_MOBILE_BREAKPOINT = 640;

    function initCanvasHeightPersistence(canvas) {
        function isDesktopWidth() {
            return window.innerWidth > TOPOLOGY_MOBILE_BREAKPOINT;
        }

        if (isDesktopWidth()) {
            var stored = parseInt(localStorage.getItem(TOPOLOGY_HEIGHT_KEY), 10);
            if (!isNaN(stored)) {
                stored = Math.max(TOPOLOGY_MIN_HEIGHT, Math.min(TOPOLOGY_MAX_HEIGHT, stored));
                canvas.style.height = stored + "px";
            }
        }

        if (window.ResizeObserver) {
            var observer = new ResizeObserver(function (entries) {
                if (!isDesktopWidth()) return;
                localStorage.setItem(TOPOLOGY_HEIGHT_KEY, Math.round(entries[0].contentRect.height));
            });
            observer.observe(canvas);
        }
    }

    function initPanZoom() {
        var canvas = document.getElementById("topology-canvas");
        var svg = document.getElementById("tp-svg");
        var zoomInBtn = document.getElementById("tp-zoom-in");
        var zoomOutBtn = document.getElementById("tp-zoom-out");
        var zoomResetBtn = document.getElementById("tp-zoom-reset");
        if (!canvas || !svg || !zoomInBtn || !zoomOutBtn || !zoomResetBtn) return;

        initCanvasHeightPersistence(canvas);

        var isDragging = false, startX = 0, startY = 0, startScrollX = 0, startScrollY = 0, moved = false;
        canvas.addEventListener("pointerdown", function (event) {
            isDragging = true; moved = false;
            startX = event.clientX; startY = event.clientY;
            startScrollX = canvas.scrollLeft; startScrollY = canvas.scrollTop;
            canvas.classList.add("is-dragging");
            canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener("pointermove", function (event) {
            if (!isDragging) return;
            var dx = event.clientX - startX, dy = event.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
            canvas.scrollLeft = startScrollX - dx;
            canvas.scrollTop = startScrollY - dy;
        });
        function endDrag(event) {
            isDragging = false;
            canvas.classList.remove("is-dragging");
            if (event && event.pointerId != null && canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
        }
        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);
        // Prevent hover tooltips on nodes from feeling like a "click" after a drag.
        canvas.addEventListener("click", function (event) { if (moved) event.stopPropagation(); }, true);

        // Zoom (buttons + Ctrl/Cmd+wheel), anchored so the point under the
        // cursor (or the viewport center, for the buttons) stays put while it scales.
        var BASE_WIDTH = 1441, BASE_HEIGHT = 825, MIN_ZOOM = 0.5, MAX_ZOOM = 2.5, STEP = 0.15;
        var zoom = 1;

        function setZoom(nextZoom, anchorClientX, anchorClientY) {
            nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
            var oldWidth = BASE_WIDTH * zoom, oldHeight = BASE_HEIGHT * zoom;
            var newWidth = BASE_WIDTH * nextZoom, newHeight = BASE_HEIGHT * nextZoom;
            var rect = canvas.getBoundingClientRect();
            var anchorOffsetX = (anchorClientX != null ? anchorClientX - rect.left : rect.width / 2);
            var anchorOffsetY = (anchorClientY != null ? anchorClientY - rect.top : rect.height / 2);
            var fractionX = (canvas.scrollLeft + anchorOffsetX) / oldWidth;
            var fractionY = (canvas.scrollTop + anchorOffsetY) / oldHeight;
            zoom = nextZoom;
            svg.style.width = newWidth.toFixed(0) + "px";
            canvas.scrollLeft = fractionX * newWidth - anchorOffsetX;
            canvas.scrollTop = fractionY * newHeight - anchorOffsetY;
            zoomResetBtn.textContent = Math.round(zoom * 100) + "%";
            zoomInBtn.disabled = zoom >= MAX_ZOOM - 0.001;
            zoomOutBtn.disabled = zoom <= MIN_ZOOM + 0.001;
        }

        zoomInBtn.addEventListener("click", function () { setZoom(zoom + STEP); });
        zoomOutBtn.addEventListener("click", function () { setZoom(zoom - STEP); });
        zoomResetBtn.addEventListener("click", function () { setZoom(1); });

        canvas.addEventListener("wheel", function (event) {
            if (!(event.ctrlKey || event.metaKey)) return; // plain wheel keeps scrolling the page
            event.preventDefault();
            setZoom(zoom - event.deltaY * 0.0015, event.clientX, event.clientY);
        }, { passive: false });

        // Keyboard equivalents of the mouse-only pan/zoom above, for
        // keyboard-only and screen-reader users.
        var PAN_STEP = 60;
        canvas.addEventListener("keydown", function (event) {
            switch (event.key) {
                case "ArrowLeft": canvas.scrollLeft -= PAN_STEP; break;
                case "ArrowRight": canvas.scrollLeft += PAN_STEP; break;
                case "ArrowUp": canvas.scrollTop -= PAN_STEP; break;
                case "ArrowDown": canvas.scrollTop += PAN_STEP; break;
                case "+": case "=": setZoom(zoom + STEP); break;
                case "-": case "_": setZoom(zoom - STEP); break;
                case "0": setZoom(1); break;
                default: return;
            }
            event.preventDefault();
        });

        // Open on a vertically-centered view — at 100% zoom the diagram
        // (BASE_HEIGHT) is taller than the wrapper (.topology-canvas's own
        // fixed height in CSS).
        canvas.scrollTop = (canvas.scrollHeight - canvas.clientHeight) / 2;
    }

    initPanZoom();
})();
