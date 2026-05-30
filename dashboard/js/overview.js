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
    cpuTemp: []
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

loadCpuHistory();
initSparklineTooltip('cpu-load-sparkline', 'cpu-load-cursor', 'cpu-load-dot', buffers.cpuLoad, '%');
initSparklineTooltip('cpu-temp-sparkline', 'cpu-temp-cursor', 'cpu-temp-dot', buffers.cpuTemp, '°C');
