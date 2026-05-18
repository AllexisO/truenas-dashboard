/**
 * cpu-page.js - CPU Detail Page
 * 
 * Fetches historical CPU temperature data
 * from Netdata via /history endpoint and
 * renders it using Chart.js.
 */

let tempChart = null;

function getChartColor(hours) {
    if (hours === 1) return "#378ADD";
    if (hours === 6) return "#1D9E75";
    return "#7F77DD";
}

function smoothData(values, window = 10) {
    return values.map((val, i) => {
        const start = Math.max(0, i - window);
        const end = Math.min(values.length, i + window);
        const slice = values.slice(start, end);
        return slice.reduce((sum, v) => sum + v, 0) / slice.length;
    });
}

async function loadChart(hours, btn) {
    document.querySelectorAll(".time-btn").forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add("active");

    const response = await fetch(`/history?graph=cputemp&hours=${hours}`);
    const result = await response.json();

    if(!result || !result[0] || !result[0].data) return;

    const points = result[0].data;
    const color = getChartColor(hours);

    const labels = points.map(point => {
        const date = new Date(point[0] * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    });

    const values = smoothData(points.map(point => point[1]));

    if (tempChart) tempChart.destroy();

    const ctx = document.querySelector("#temp-chart").getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);

    gradient.addColorStop(0, color + "40");
    gradient.addColorStop(1, color + "00");

    tempChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                data: values,
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 1.5,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#0D1520",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderWidth: 1,
                    titleColor: "#64748B",
                    bodyColor: "#E2E8f0",
                    callbacks: {
                        label: ctx => `${ctx.raw}°C`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: "#475569",
                        font: {
                            size: 10,
                            family: "monospace"
                        },
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: { color: "rgba(255,255,255,0.04)" },
                    ticks: {
                        color: "#475569",
                        font: {
                            size: 10,
                            family: "monospace"
                        },
                        callback: v => v + '°C'
                    }
                }
            }
        }
    });
}

loadChart(1, document.querySelector('.time-btn'));

const WS_PORT = 8765;
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`;

function connectLive() {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (!tempChart || !data.realtime?.cpu?.cpu?.temp) return;

        const temp = data.realtime.cpu.cpu.temp;
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        tempChart.data.labels.push(now);
        tempChart.data.labels.shift();
        tempChart.data.datasets[0].data.push(temp);
        tempChart.data.datasets[0].data.shift();
        tempChart.update('none');
    };

    ws.onclose = () => setTimeout(connectLive, 3000);
}

connectLive();