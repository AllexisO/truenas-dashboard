// ============================
// CPU summary card — rendering only
// ============================

const RING_CIRCUMFERENCE = 314.16; // 2π × 50

function updateRingProgress(elementId, progress) {
    const ring = document.getElementById(elementId);
    const clamped = Math.max(0, Math.min(1, progress));
    ring.setAttribute('stroke-dasharray', RING_CIRCUMFERENCE);
    ring.setAttribute('stroke-dashoffset', RING_CIRCUMFERENCE * (1 - clamped));
}

function updateDonutSegment(id, pct, offsetPct) {
    let element = document.getElementById(id);
    if (!element) return;

    let dash = (pct / 100) * RING_CIRCUMFERENCE;
    let offset = (offsetPct / 100) * RING_CIRCUMFERENCE;

    element.setAttribute("stroke-dasharray", `${dash} ${RING_CIRCUMFERENCE - dash}`);
    element.setAttribute("stroke-dashoffset", -offset);
}

// function renderSparkline(svgElement, data) {
//     const lineEl = svgElement.querySelector('.sparkline-line');
//     const areaEl = svgElement.querySelector('.sparkline-area');
//     if (!data || data.length < 2) {
//         lineEl.setAttribute('points', '');
//         areaEl.setAttribute('d', '');
//         return;
//     }

//     const width = 100;
//     const height = 40;
//     const padding = 2;
//     const drawHeight = height - padding * 2;

//     const min = Math.min(...data);
//     const max = Math.max(...data);
//     const range = max - min || 1;

//     const points = data.map((value, index) => {
//         const x = (index / (data.length - 1)) * width;
//         const y = padding + drawHeight - ((value - min) / range) * drawHeight;
//         return `${x.toFixed(2)},${y.toFixed(2)}`;
//     });

//     lineEl.setAttribute('points', points.join(' '));
//     areaEl.setAttribute('d', `M0,${height} L${points.join(' L')} L${width},${height} Z`);
// }

function computeLinePoints(data, min, max, width, height, padding) {
    let range = max - min || 1;
    let drawHeight = height - padding * 2;

    return data.map((value, index) => {
        let x = (index / (data.length - 1)) * width;
        let y = padding + drawHeight - ((value - min) / range) * drawHeight;

        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
}

function renderSparkline(svgElement, data) {
    let lineElement = svgElement.querySelector(".sparkline-line");
    let areaElement = svgElement.querySelector(".sparkline-area");

    if (!data || data.length < 2) {
        lineElement.setAttribute("points", "");
        areaElement.setAttribute("d", "");
        return;
    }

    let width = 100;
    let height = 40;
    let padding = 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const points = computeLinePoints(data, min, max, width, height, padding);

    lineElement.setAttribute("points", points.join(" "));
    areaElement.setAttribute("d", `M0,${height} L${points.join(" L")} L${width},${height} Z`);
}

function formatNetworkSpeed(bytesPerSecond) {
    let bitsPerSecond = bytesPerSecond * 8;
    if (bitsPerSecond >= 1000000) return { value: (bitsPerSecond / 1000000).toFixed(2), unit: "Mb/s" };
    if (bitsPerSecond >= 1000) return { value: (bitsPerSecond / 1000).toFixed(2), unit: "Kb/s" };
    return { value: Math.round(bitsPerSecond ?? 0), unit: "b/s" };
}

function formatBytesUnit(bytes) {
    if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(1) + " TB";
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    
    return (bytes / 1024).toFixed(1) + " Kb";
}

function updateNetworkCard({rx, tx }) {
    let rxFormatted = formatNetworkSpeed(rx);
    let txFormatted = formatNetworkSpeed(tx);

    document.getElementById("net-rx-value").textContent = rxFormatted.value;
    document.getElementById("net-rx-unit").textContent = rxFormatted.unit;

    document.getElementById("net-tx-value").textContent = txFormatted.value;
    document.getElementById("net-tx-unit").textContent = txFormatted.unit;
}

function updateNetworkSparklines(rxHistory, txHistory) {
    renderSparkline(document.getElementById("net-rx-sparkline").closest(".sparkline"), rxHistory);
    renderSparkline(document.getElementById("net-tx-sparkline").closest(".sparkline"), txHistory);
}

function updateNetworkTotals(totalRx, totalTx) {
    let rxEl = document.getElementById('net-total-rx');
    let txEl = document.getElementById('net-total-tx');

    if (rxEl) rxEl.textContent = formatBytesUnit(totalRx);
    if (txEl) txEl.textContent = formatBytesUnit(totalTx);
}

function updateCpuLoad({ percent, history, min, max, minTime, maxTime }) {
    updateRingProgress('cpu-load-ring', percent / 100);
    document.getElementById('cpu-load-percent').textContent = Math.round(percent);
    renderSparkline(document.getElementById('cpu-load-sparkline').closest('.sparkline'), history);
    document.getElementById('cpu-load-min').textContent = `${min}%`;
    document.getElementById('cpu-load-max').textContent = `${max}%`;
    document.getElementById('cpu-load-min-time').textContent = `${minTime}`;
    document.getElementById('cpu-load-max-time').textContent = `${maxTime}`;
}

function updateCpuTemp({ degrees, history, min, max, minTime, maxTime }) {
    updateRingProgress('cpu-temp-ring', degrees / 100);
    document.getElementById('cpu-temp-degrees').textContent = Math.round(degrees);
    renderSparkline(document.getElementById('cpu-temp-sparkline').closest('.sparkline'), history);
    document.getElementById('cpu-temp-min').textContent = `${min}°C`;
    document.getElementById('cpu-temp-max').textContent = `${max}°C`;
    document.getElementById('cpu-temp-min-time').textContent = `${minTime}`;
    document.getElementById('cpu-temp-max-time').textContent = `${maxTime}`;
}

/* Sparkline for graphic */
function initSparklineTooltip(svgId, cursorId, dotId, bufferRef, unit, formatter = null) {
    let svg = document.getElementById(svgId).closest('.sparkline');
    let cursor = document.getElementById(cursorId);
    let dot = document.getElementById(dotId);
    let tooltip = document.getElementById("sparkline-tooltip");

    svg.addEventListener("mousemove", (event) => {
        const rect = svg.getBoundingClientRect();
        const wrapRect = svg.parentElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, mouseX / rect.width));

        const data = bufferRef;
        if (!data.length) return;
        if (data.length < 2) return;

        const index = Math.round(ratio * (data.length - 1));
        const sample = data[index];
        if (!sample) return;

        const min = Math.min(...data.map(s => s.value));
        const max = Math.max(...data.map(s => s.value));
        const range = max - min || 1;

        const padding = 2;
        const drawHeight = 40 - padding * 2;
        const svgX = (index / (data.length - 1)) * 100;
        if (!isFinite(svgX)) return;
        
        const svgY = padding + drawHeight - ((sample.value - min) / range) * drawHeight;

        const pt = svg.createSVGPoint();
        pt.x = svgX;
        pt.y = svgY;
        const screenPt = pt.matrixTransform(svg.getScreenCTM());

        cursor.setAttribute("x1", svgX);
        cursor.setAttribute("x2", svgX);

        dot.style.left = (screenPt.x - wrapRect.left) + 'px';
        dot.style.top = (screenPt.y - wrapRect.top) + 'px';

        tooltip.style.left = (event.clientX + 12) + 'px';
        tooltip.style.top = (event.clientY - 24) + 'px';

        const date = new Date(sample.time);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const timeWithSeconds = `${hours}:${minutes}:${seconds}`;

        // tooltip.textContent = `${Math.round(sample.value)}${unit} ${timeWithSeconds}`;
        if (formatter) {
            tooltip.textContent = formatter(sample.value) + ' · ' + timeWithSeconds;
        } else {
            tooltip.textContent = `${Math.round(sample.value)}${unit} · ${timeWithSeconds}`;
        }
    });
    
    svg.addEventListener("mouseenter", () => {
        cursor.setAttribute("visibility", "visible");
        dot.style.display = "block";
        tooltip.style.display = "block";
    });

    svg.addEventListener("mouseleave", () => {
        cursor.setAttribute("visibility", "hidden");
        dot.style.display = "none";
        tooltip.style.display = "none";
    });
}

function updateRamCard({ percent, total, used, free, arc }) {
    updateRingProgress("ram-ring", percent / 100);
    document.getElementById("ram-percent").textContent = Math.round(percent);
    document.getElementById("ram-total").textContent = total;
    document.getElementById("ram-used").textContent = used;
    document.getElementById("ram-free").textContent = free;
    document.getElementById("ram-arc").textContent = arc;
}

function updateRamSparkline(history) {
    renderSparkline(document.getElementById("ram-sparkline").closest(".sparkline"), history);
}

function getDiskStatusColor(percent) {
    if (percent >= 90) return "#E24B4A";
    if (percent >= 60) return "#BA7517";
    return "#378ADD";
}

function buildDiskPoolMap(pools) {
    const diskPoolMap = {};
    if (!pools) return diskPoolMap;

    pools.forEach(pool => {
        const walkVdevs = (vdevs) => {
            vdevs.forEach(vdev => {
                if (vdev.disk) {
                    diskPoolMap[vdev.disk] = pool;
                }
                if (vdev.children) walkVdevs(vdev.children);
            });
        };
        if (pool.topology?.data) walkVdevs(pool.topology.data);
    });

    return diskPoolMap;
}

function buildDisksOverviewList(data) {
    const list = document.getElementById("disks-overview-list");
    if (!list || list.children.length > 0) return;

    let disks = data.disks;
    let temps = data.disk_temps;
    let pools = data.pools;
    let bootDisks = data.boot_disks;
    let bootDisk = data.boot_disk;

    if(!disks) return;

    // Build disk -> pool map
    const diskPoolMap = buildDiskPoolMap(pools);

    let totalCapacity = 0;
    let totalUsed = 0;
    let healthyCount = 0;
    let warningCount = 0;
    let failedCount = 0;

    const shouldBuildList = list && list.children.length === 0;
    const template = shouldBuildList ? document.getElementById("disk-overview-item-template") : null;
    
    disks.forEach(disk => {
        totalCapacity += disk.size;

        let pool = diskPoolMap[disk.name];
        let isBootDisk = bootDisks?.includes(disk.name);

        let percent = null;
        let healthy = true;

        if (pool) {
            percent = Math.round((pool.allocated / pool.size) * 100);
            healthy = pool.healthy && !pool.warning;

            if (!pool.healthy) failedCount++;
            else if (pool.warning) warningCount++;
            else healthyCount++;
        } else if (isBootDisk && bootDisk) {
            percent = Math.round((bootDisk.used / bootDisk.total) * 100);
            healthyCount++;
        } else {
            healthyCount++;
        }

        if (!shouldBuildList) return;


        let temp = temps?.[disk.name];
        let color = percent !== null ? getDiskStatusColor(percent) : "#378ADD";
        
        let clone = template.content.cloneNode(true);
        let item = clone.querySelector(".disk-overview-item");
        item.dataset.diskName = disk.name;

        let icon = clone.querySelector(".disk-status-icon");
        let path = clone.querySelector(".disk-status-path");

        if (healthy) {
            icon.setAttribute("stroke", "var(--success)");
            path.setAttribute("d", "M22 11.08V12a10 10 0 1 1-5.93-9.14");
            let poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            poly.setAttribute("points", "22 4 12 14.01 9 11.01");
            icon.appendChild(poly);
        } else {
            icon.setAttribute("stroke", "var(--warning)");
            path.setAttribute("d", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z");
            let line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line1.setAttribute('x1', '12'); line1.setAttribute('y1', '9');
            line1.setAttribute('x2', '12'); line1.setAttribute('y2', '13');
            let line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line2.setAttribute('x1', '12'); line2.setAttribute('y1', '17');
            line2.setAttribute('x2', '12.01'); line2.setAttribute('y2', '17');
            icon.appendChild(line1);
            icon.appendChild(line2);
        }

        clone.querySelector(".disk-overview-name").textContent = disk.name;

        let statusEl = clone.querySelector(".disk-overview-status");
        statusEl.textContent = healthy ? "Healthy" : "Warning";
        statusEl.className = `disk-overview-status ${healthy ? "healthy" : "warning"}`;

        clone.querySelector(".disk-overview-temp").textContent = temp !== undefined ? Math.round(temp) + "°C" : "";

        let bar = clone.querySelector(".disk-overview-bar");
        bar.style.width = (percent ?? 0) + "%";
        bar.style.background = color;

        clone.querySelector(".disk-overview-percent").textContent = percent !== null ? percent + "%" : "";

        list.appendChild(clone);
    });

    // Disks Overview panel totals + donut
    pools?.forEach(pool => {
        totalUsed += pool.allocated;
    });

    if (bootDisk) {
        totalUsed += bootDisk.used;
    }

    let total = disks.length;

    let totalCountElement = document.querySelector("#disks-total-count");
    if (totalCountElement) totalCountElement.textContent = total;

    let totalCapacityElement = document.querySelector("#disks-total-capacity");
    if (totalCapacityElement) totalCapacityElement.textContent = formatBytesUnit(totalCapacity);

    let totalUsedElement = document.querySelector("#disks-total-used");
    if (totalUsedElement) totalUsedElement.textContent = formatBytesUnit(totalUsed);

    let healthyCountElement = document.querySelector("#disks-healthy-count");
    if (healthyCountElement) healthyCountElement.textContent = healthyCount;

    let warningCountElement = document.querySelector("#disks-warning-count");
    if (warningCountElement) warningCountElement.textContent = warningCount;

    let failedCountElement = document.querySelector("#disks-failed-count");
    if (failedCountElement) failedCountElement.textContent = failedCount;

    let healthyPct = total > 0 ? Math.round((healthyCount / total) * 100) : 0;
    let warningPct = total > 0 ? Math.round((warningCount / total) * 100) : 0;
    let failedPct = total > 0 ? Math.round((failedCount / total) * 100) : 0;

    let healthyPctElement = document.querySelector("#donut-healthy-pct");
    if (healthyPctElement) healthyPctElement.textContent = healthyPct + '%';

    let warningPctElement = document.querySelector("#donut-warning-pct");
    if (warningPctElement) warningPctElement.textContent = warningPct + '%';

    let failedPctElement = document.querySelector("#donut-failed-pct");
    if (failedPctElement) failedPctElement.textContent = failedPct + '%';

    updateDonutSegment("donut-healthy", healthyPct, 0);
    updateDonutSegment("donut-warning", warningPct, healthyPct);
    updateDonutSegment("donut-failed", failedPct, healthyPct + warningPct);
}

function updateDisksIO(disks) {
    if (!disks) return;

    const readEl = document.getElementById('disk-read-speed');
    const writeEl = document.getElementById('disk-write-speed');
    const iopsEl = document.getElementById('disk-iops');
    const busyEl = document.getElementById('disk-busy');

    if (readEl) readEl.textContent = (disks.read_bytes / 1048576).toFixed(1);
    if (writeEl) writeEl.textContent = (disks.write_bytes / 1048576).toFixed(1);
    if (iopsEl) iopsEl.textContent = Math.round(disks.read_ops + disks.write_ops);
    if (busyEl) {
        const busy = Math.round(disks.busy);
        busyEl.textContent = busy;
        busyEl.style.color = busy >= 80 ? 'var(--failed)' : busy >= 50 ? 'var(--warning)' : 'var(--text)';
    }
}

function updateDisksOverviewList(data) {
    const list = document.getElementById("disks-overview-list");
    if (!list || !list.children.length) return;

    let temps = data.disk_temps;
    if (!temps) return;

    list.querySelectorAll(".disk-overview-item").forEach(item => {
        let diskName = item.dataset.diskName;
        let temp = temps[diskName];

        if (temp !== undefined) {
            let tempEl = item.querySelector(".disk-overview-temp");
            if (tempEl) tempEl.textContent = Math.round(temp) + '°C';
        }
    });
}

function downsample(data, maxPoints) {
    if (data.length <= maxPoints) return data;
    const chunkSize = Math.ceil(data.length / maxPoints);
    const result = [];
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const avg = chunk.reduce((sum, v) => sum + v, 0) / chunk.length;
        result.push(avg);
    }
    return result;
}

function renderDisksOverviewChart(combined) {
    const svg = document.getElementById('disks-overview-chart-svg');
    if (!svg) return;

    const rawReads = combined.map(p => p.reads / 1024);   // KiB/s -> MB/s
    const rawWrites = combined.map(p => p.writes / 1024); // KiB/s -> MB/s

    const reads = downsample(rawReads, 60);
    const writes = downsample(rawWrites, 60);

    const allValues = [...reads, ...writes];
    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues, 1);

    const width = 600;
    const height = 200;
    const padding = 8;

    const readPoints = computeLinePoints(reads, min, max, width, height, padding);
    const writePoints = computeLinePoints(writes, min, max, width, height, padding);

    svg.querySelector('.disks-chart-read-line').setAttribute('points', readPoints.join(' '));
    svg.querySelector('.disks-chart-write-line').setAttribute('points', writePoints.join(' '));

    let readEl = document.getElementById('disk-chart-read');
    let writeEl = document.getElementById('disk-chart-write');

    if (readEl) readEl.textContent = (rawReads[rawReads.length - 1] ?? 0).toFixed(1);
    if (writeEl) writeEl.textContent = (rawWrites[rawWrites.length - 1] ?? 0).toFixed(1);
}

// Placeholder fot preview
const placeholderSparkline = [12, 18, 25, 22, 30, 35, 28, 38, 42, 36, 44, 40, 48, 52, 45, 50, 48, 53, 49, 51];
renderSparkline(document.getElementById('cpu-load-sparkline').closest('.sparkline'), placeholderSparkline);
renderSparkline(document.getElementById('cpu-temp-sparkline').closest('.sparkline'), placeholderSparkline);
