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

function renderSparkline(svgElement, data) {
    const lineEl = svgElement.querySelector('.sparkline-line');
    const areaEl = svgElement.querySelector('.sparkline-area');
    if (!data || data.length < 2) {
        lineEl.setAttribute('points', '');
        areaEl.setAttribute('d', '');
        return;
    }

    const width = 100;
    const height = 40;
    const padding = 2;
    const drawHeight = height - padding * 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = padding + drawHeight - ((value - min) / range) * drawHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    lineEl.setAttribute('points', points.join(' '));
    areaEl.setAttribute('d', `M0,${height} L${points.join(' L')} L${width},${height} Z`);
}

function formatNetworkSpeed(bytesPerSecond) {
    let bitsPerSecond = bytesPerSecond * 8;
    if (bitsPerSecond >= 1000000) return { value: (bitsPerSecond / 1000000).toFixed(2), unit: "Mb/s" };
    if (bitsPerSecond >= 1000) return { value: (bitsPerSecond / 1000).toFixed(2), unit: "Kb/s" };
    return { value: Math.round(bitsPerSecond ?? 0), unit: "b/s" };
}

function formatNetworkTotal(bytes) {
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

    if (rxEl) rxEl.textContent = formatNetworkTotal(totalRx);
    if (txEl) txEl.textContent = formatNetworkTotal(totalTx);
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


// Placeholder fot preview
const placeholderSparkline = [12, 18, 25, 22, 30, 35, 28, 38, 42, 36, 44, 40, 48, 52, 45, 50, 48, 53, 49, 51];
renderSparkline(document.getElementById('cpu-load-sparkline').closest('.sparkline'), placeholderSparkline);
renderSparkline(document.getElementById('cpu-temp-sparkline').closest('.sparkline'), placeholderSparkline);
