/**
 * overview.js - Overview Page Logic
 *
 * Handles data processing for the main overview page.
 * Receives realtime data from app.js and calls
 * rendering functions from new-apex.js.
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

function getMinMax(buffer) {
    if (!buffer.length) return null;
    let min = buffer[0];
    let max = buffer[0];
    for (const sample of buffer) {
        if (sample.value < min.value) min = sample;
        if (sample.value > max.value) max = sample;
    }
    return { min, max };
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function handleRealtimeData(data) {
    const cpuData = data.realtime?.cpu?.cpu;
    if (!cpuData) return;

    const usage = cpuData.usage;
    const temp = cpuData.temp;

    if (typeof usage === 'number') {
        pushSample(buffers.cpuLoad, usage);
        const stats = getMinMax(buffers.cpuLoad);
        updateCpuLoad({
            percent: usage,
            history: buffers.cpuLoad.map(sample => sample.value),
            min: Math.round(stats.min.value),
            max: Math.round(stats.max.value),
            minTime: formatTime(stats.min.time),
            maxTime: formatTime(stats.max.time)
        });
    }

    if (typeof temp === 'number') {
        pushSample(buffers.cpuTemp, temp);
        const stats = getMinMax(buffers.cpuTemp);
        updateCpuTemp({
            degrees: temp,
            history: buffers.cpuTemp.map(sample => sample.value),
            min: Math.round(stats.min.value),
            max: Math.round(stats.max.value),
            minTime: formatTime(stats.min.time),
            maxTime: formatTime(stats.max.time)
        });
    }
}