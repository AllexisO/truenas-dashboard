// ============================
// CPU summary card
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

function updateCpuLoad({ percent, history, min, max, minTime, maxTime }) {
    updateRingProgress('cpu-load-ring', percent / 100);
    document.getElementById('cpu-load-percent').textContent = Math.round(percent);
    renderSparkline(document.getElementById('cpu-load-sparkline').closest('.sparkline'), history);
    document.getElementById('cpu-load-min').textContent = `${min}%`;
    document.getElementById('cpu-load-max').textContent = `${max}%`;
    document.getElementById('cpu-load-min-time').textContent = `· ${minTime}`;
    document.getElementById('cpu-load-max-time').textContent = `· ${maxTime}`;
}

function updateCpuTemp({ degrees, history, min, max, minTime, maxTime }) {
    updateRingProgress('cpu-temp-ring', degrees / 100);
    document.getElementById('cpu-temp-degrees').textContent = Math.round(degrees);
    renderSparkline(document.getElementById('cpu-temp-sparkline').closest('.sparkline'), history);
    document.getElementById('cpu-temp-min').textContent = `${min}°C`;
    document.getElementById('cpu-temp-max').textContent = `${max}°C`;
    document.getElementById('cpu-temp-min-time').textContent = `· ${minTime}`;
    document.getElementById('cpu-temp-max-time').textContent = `· ${maxTime}`;
}

const placeholderSparkline = [12, 18, 25, 22, 30, 35, 28, 38, 42, 36, 44, 40, 48, 52, 45, 50, 48, 53, 49, 51];
renderSparkline(document.getElementById('cpu-load-sparkline').closest('.sparkline'), placeholderSparkline);
renderSparkline(document.getElementById('cpu-temp-sparkline').closest('.sparkline'), placeholderSparkline);

// ============================
// WebSocket: real-time data
// ============================

const WS_URL = `ws://${window.location.hostname}:8765`;
const BUFFER_SIZE = 60; // ~2 минуты при сэмпле раз в 2 секунды

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

function connectWebSocket() {
    const ws = new WebSocket(WS_URL);

    ws.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleRealtimeData(data);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    });

    ws.addEventListener('close', () => {
        // авто-реконнект через 3 секунды
        setTimeout(connectWebSocket, 3000);
    });

    ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });
}

connectWebSocket();