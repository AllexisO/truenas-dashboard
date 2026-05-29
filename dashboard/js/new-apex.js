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

// Placeholder пока нет реальных данных
const placeholderSparkline = [12, 18, 25, 22, 30, 35, 28, 38, 42, 36, 44, 40, 48, 52, 45, 50, 48, 53, 49, 51];
renderSparkline(document.getElementById('cpu-load-sparkline').closest('.sparkline'), placeholderSparkline);
renderSparkline(document.getElementById('cpu-temp-sparkline').closest('.sparkline'), placeholderSparkline);