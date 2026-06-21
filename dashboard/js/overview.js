/**
 * overview.js - Overview Page Logic
 *
 * Handles data processing for the main overview page.
 * Receives realtime data from app.js and calls
 * rendering functions from new-apex.js.
 * 
 */

const BUFFER_SIZE = 60;

const buffers = {
    cpuLoad: [],
    cpuTemp: [],
    ram: [],
    netRx: [],
    netTx: [],
    diskRead: [],
    diskWrite: []
};

function pushSample(buffer, value) {
    buffer.push({ value, time: Date.now() });
    if (buffer.length > BUFFER_SIZE) buffer.shift();
}

function formatBytes(bytes) {
    let gb = bytes / 1073741824;
    return gb.toFixed(1) + " GB";
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const timeWithSeconds = `${hours}:${minutes}:${seconds}`;

    return `${hours}:${minutes}`;
}

function handleRealtimeData(data) {
    const cpuData = data.realtime?.cpu?.cpu;
    const memory = data.realtime?.memory;
    const interfaces = data.realtime?.interfaces;

    if (!cpuData) return;

    let usage = cpuData.usage;
    let temp = cpuData.temp;

    if (typeof usage === "number") {
        pushSample(buffers.cpuLoad, usage);
        updateCpuLoad({
            percent: usage,
            history: buffers.cpuLoad.map(sample => sample.value),
            min: cpuLoadStats.min ? Math.round(cpuLoadStats.min.value) : "0",
            max: cpuLoadStats.max ? Math.round(cpuLoadStats.max.value) : "0",
            minTime: cpuLoadStats.min ? formatTime(cpuLoadStats.min.time) : "0",
            maxTime: cpuLoadStats.max ? formatTime(cpuLoadStats.max.time) : "0"
        });
    }

    if (typeof temp === "number") {
        pushSample(buffers.cpuTemp, temp);
        updateCpuTemp({
            degrees: temp,
            history: buffers.cpuTemp.map(sample => sample.value),
            min: cpuTempStats.min ? Math.round(cpuTempStats.min.value) : "0",
            max: cpuTempStats.max ? Math.round(cpuTempStats.max.value) : "0",
            minTime: cpuTempStats.min ? formatTime(cpuTempStats.min.time) : "0",
            maxTime: cpuTempStats.max ? formatTime(cpuTempStats.max.time) : "0"
        });
    }

    if (memory) {
        let total = memory.physical_memory_total;
        let available = memory.physical_memory_available;
        let used = total - available;
        let arc = memory.arc_size;
        let percent = (used / total) * 100;

        pushSample(buffers.ram, percent);

        updateRamCard({
            percent,
            total: formatBytes(total),
            used: formatBytes(used),
            free: formatBytes(available),
            arc: formatBytes(arc)
        });

        updateRamSparkline(buffers.ram.map(sample => sample.value));

        let zfs = data.realtime?.zfs;
        let hits = zfs?.demand_data_hits_per_second ?? 0;
        let accesses = zfs?.demand_data_accesses_per_second ?? 0;
        let arcHitRate = accesses > 0 ? Math.round((hits / accesses) * 100) : 0;

        let arcEl = document.getElementById("ram-arc-hit");
        let arcSizeEl = document.getElementById("ram-arc-size");

        if (arcEl) arcEl.textContent = arcHitRate + "%";
        if (arcSizeEl) arcSizeEl.textContent = formatBytes(arc);
    }

    if (interfaces) {
        const ifaceName = Object.keys(interfaces)[0];
        
        if (ifaceName) {
            const iface = interfaces[ifaceName];
            const rx = iface.received_bytes_rate;
            const tx = iface.sent_bytes_rate;

            pushSample(buffers.netRx, rx);
            pushSample(buffers.netTx, tx);

            updateNetworkCard({ rx, tx });
            updateNetworkSparklines(
                buffers.netRx.map(s => s.value),
                buffers.netTx.map(s => s.value)
            );
        }
    }

    const netTotals = data.net_totals;
    if (netTotals) {
        updateNetworkTotals(netTotals.rx, netTotals.tx);
    }

    // Disks
    let disksIO = data.realtime?.disks;
    if (disksIO) {
        const { readMBs, writeMBs } = updateDisksIO(disksIO);
        pushSample(buffers.diskRead, readMBs);
        pushSample(buffers.diskWrite, writeMBs);
        renderDisksOverviewChart(
            buffers.diskRead.map(s => s.value),
            buffers.diskWrite.map(s => s.value)
        );
    }

    if (data.disks) {
        if (!document.getElementById("disks-overview-list").children.length) {
            buildDisksOverviewList(data);
        } else {
            updateDisksOverviewList(data);
        }
    }

    if (data.pools) {
        buildPoolsTable(data);
    }
}

let cpuLoadStats = { min: null, max: null };
let cpuTempStats = { min: null, max: null };

async function loadCpuHistory() {
    const [loadResponse, tempResponse] = await Promise.all([
        fetch('/history?graph=cpu&hours=24'),
        fetch('/history?graph=cputemp&hours=24')
    ]);

    const loadResult = await loadResponse.json();
    const tempResult = await tempResponse.json();

    if (loadResult?.[0]?.data) {
        const points = loadResult[0].data;
        
        points.forEach(point => {
            let value = point[1];
            let time = point[0] * 1000;

            if (value === null || value <= 0) return;

            if (!cpuLoadStats.min || value < cpuLoadStats.min.value) cpuLoadStats.min = { value, time };
            if (!cpuLoadStats.max || value > cpuLoadStats.max.value) cpuLoadStats.max = { value, time };
        });
    }

    if (tempResult?.[0]?.data) {
        const points = tempResult[0].data;
        
        points.forEach(point => {
            let value = point[1];
            let time = point[0] * 1000;
            
            if (value === null || value <= 0) return;

            if (!cpuTempStats.min || value < cpuTempStats.min.value) cpuTempStats.min = { value, time };
            if (!cpuTempStats.max || value > cpuTempStats.max.value) cpuTempStats.max = { value, time };
        });
    }
}

function initDisksChartTooltip(svgId, cursorId, readDotId, writeDotId, readBufferRef, writeBufferRef) {
    let svg = document.getElementById(svgId);
    let wrapper = svg.parentElement;
    let cursor = document.getElementById(cursorId);
    let readDot = document.getElementById(readDotId);
    let writeDot = document.getElementById(writeDotId);
    let tooltip = document.getElementById("sparkline-tooltip");

    svg.addEventListener("mousemove", (event) => {
        const rect = svg.getBoundingClientRect();
        const wrapRect = wrapper.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;

        const readData = readBufferRef;
        const writeData = writeBufferRef;
        if (readData.length < 2 || writeData.length < 2) return;

        const width = 600;
        const height = 200;
        const padding = 8;
        const totalSlots = BUFFER_SIZE;
        const slotWidth = width / (totalSlots - 1);
        const startSlot = totalSlots - readData.length;

        const ratio = mouseX / rect.width;
        const slot = ratio * (totalSlots - 1);
        const index = Math.round(slot - startSlot);

        if (index < 0 || index >= readData.length) return;

        const readSample = readData[index];
        const writeSample = writeData[index];
        if (!readSample || !writeSample) return;

        const allValues = [...readData.map(s => s.value), ...writeData.map(s => s.value)];
        const min = Math.min(...allValues, 0);
        const max = Math.max(...allValues, 1);
        const range = max - min || 1;
        const drawHeight = height - padding * 2;

        const svgX = (startSlot + index) * slotWidth;
        const readY = padding + drawHeight - ((readSample.value - min) / range) * drawHeight;
        const writeY = padding + drawHeight - ((writeSample.value - min) / range) * drawHeight;

        cursor.setAttribute("x1", svgX);
        cursor.setAttribute("x2", svgX);

        const toScreen = (x, y) => {
            const pt = svg.createSVGPoint();
            pt.x = x;
            pt.y = y;
            return pt.matrixTransform(svg.getScreenCTM());
        };

        const readScreen = toScreen(svgX, readY);
        const writeScreen = toScreen(svgX, writeY);

        readDot.style.left = (readScreen.x - wrapRect.left) + 'px';
        readDot.style.top = (readScreen.y - wrapRect.top) + 'px';
        writeDot.style.left = (writeScreen.x - wrapRect.left) + 'px';
        writeDot.style.top = (writeScreen.y - wrapRect.top) + 'px';

        tooltip.style.left = (event.clientX + 12) + 'px';
        tooltip.style.top = (event.clientY - 24) + 'px';

        const date = new Date(readSample.time);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        tooltip.textContent = `Read ${readSample.value.toFixed(1)} MB/s · Write ${writeSample.value.toFixed(1)} MB/s · ${hours}:${minutes}:${seconds}`;
    });

    svg.addEventListener("mouseenter", () => {
        cursor.setAttribute("visibility", "visible");
        readDot.style.display = "block";
        writeDot.style.display = "block";
        tooltip.style.display = "block";
    });

    svg.addEventListener("mouseleave", () => {
        cursor.setAttribute("visibility", "hidden");
        readDot.style.display = "none";
        writeDot.style.display = "none";
        tooltip.style.display = "none";
    });
}

loadCpuHistory();
initSparklineTooltip("cpu-load-sparkline", "cpu-load-cursor", "cpu-load-dot", buffers.cpuLoad, '%');
initSparklineTooltip("cpu-temp-sparkline", "cpu-temp-cursor", "cpu-temp-dot", buffers.cpuTemp, '°C');
initSparklineTooltip("ram-sparkline", "ram-cursor", "ram-dot", buffers.ram, "%");
initSparklineTooltip("net-rx-sparkline", "net-rx-cursor", "net-rx-dot", buffers.netRx, "", (v) => {
    let formatted = formatNetworkSpeed(v);
    return `${formatted.value} ${formatted.unit}`;
});
initSparklineTooltip("net-tx-sparkline", "net-tx-cursor", "net-tx-dot", buffers.netTx, "", (v) => {
    let formatted = formatNetworkSpeed(v);
    return `${formatted.value} ${formatted.unit}`;
});
initDisksChartTooltip("disks-overview-chart-svg", "disks-chart-cursor", "disks-chart-read-dot", "disks-chart-write-dot", buffers.diskRead, buffers.diskWrite);
