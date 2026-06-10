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
    netTx: []
};

function pushSample(buffer, value) {
    buffer.push({ value, time: Date.now() });
    if (buffer.length > BUFFER_SIZE) buffer.shift();
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

function formatBytes(bytes) {
    let gb = bytes / 1073741824;
    return gb.toFixed(1) + " GB";
}

let networkStats = { totalRx: 0, totalTx: 0 };

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
