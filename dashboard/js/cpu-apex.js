/**
 * cpu-apex.js - CPU Detail Page (ApexCharts)
 */

let tempChart = null;
const WS_URL = `ws://${window.location.hostname}:8765`;

function getMaxPoints(hours) {
    if (hours === 1) return 60;
    if (hours === 6) return 72;
    return 48;
}

async function loadChart(hours, btn) {
    console.log('loadChart called', hours);
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    console.log('fetching data...');
    const response = await fetch(`/history?graph=cputemp&hours=${hours}`);
    const result = await response.json();
    console.log('data received', result?.length);

    if (!result || !result[0] || !result[0].data) return;

    const points = result[0].data;
    const maxPoints = getMaxPoints(hours);
    const step = Math.max(1, Math.floor(points.length / maxPoints));
    
    const sampled = [];
    for (let i = points.length - 1; i >= 0; i -= step) {
        sampled.unshift(points[i]);
        if (sampled.length >= maxPoints) break;
    }

    // const chartData = sampled.map(point => ({ x: point[0] * 1000, y: point[1] }));
    const chartData = averagePoints(points, maxPoints);

    if (tempChart) {
        tempChart.updateSeries([{ data: chartData }], false);
        return;
    }

    tempChart = new ApexCharts(document.querySelector('#temp-chart'), {
        chart: {
            type: 'area',
            height: 300,
            background: 'transparent',
            toolbar: { show: true },
            zoom: { enabled: false },
            animations: {
                enabled: true,
                easing: 'easeinout'
            }
        },
        theme: { mode: 'dark' },
        series: [{ name: 'Temperature', data: chartData }],
        stroke: { curve: 'smooth', width: 2.5 },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'vertical',
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.05,
                stops: [0, 100]
            }
        },
        colors: ['#378ADD'],
        dataLabels: { enabled: false },
        xaxis: {
            type: 'datetime',
            labels: {
                style: { colors: '#475569', fontFamily: 'monospace', fontSize: '10px' },
                datetimeUTC: false,
                format: 'HH:mm'
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: '#475569', fontFamily: 'monospace', fontSize: '10px' },
                formatter: v => v.toFixed(0) + '°C'
            }
        },
        grid: { show: false },
        tooltip: {
            theme: 'dark',
            x: { format: 'HH:mm' },
            y: { formatter: v => v.toFixed(1) + '°C' }
        }
    });

    tempChart.render();
}

function averagePoints(points, maxPoints) {
    const chunkSize = Math.floor(points.length / maxPoints);
    const result = [];
    
    for (let i = 0; i < points.length; i += chunkSize) {
        const chunk = points.slice(i, i + chunkSize);
        const avgTemp = chunk.reduce((sum, p) => sum + p[1], 0) / chunk.length;
        const timestamp = chunk[Math.floor(chunk.length / 2)][0]; // средний timestamp
        result.push({ x: timestamp * 1000, y: parseFloat(avgTemp.toFixed(1)) });
        if (result.length >= maxPoints) break;
    }
    
    return result;
}

// Reload every 30 seconds
setInterval(() => {
    const activeBtn = document.querySelector('.time-btn.active');
    const hours = activeBtn ? parseInt(activeBtn.textContent) : 1;
    loadChart(hours, activeBtn);
}, 30000);




let cpuLoadChart = null;

async function loadLoadChart(hours, btn) {
    document.querySelectorAll('.time-btn-load').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const response = await fetch(`/history?graph=cpu&hours=${hours}`);
    const result = await response.json();

    if (!result || !result[0] || !result[0].data) return;

    const points = result[0].data;
    const maxPoints = getMaxPoints(hours);
    const chartData = averagePoints(points, maxPoints);

    if (cpuLoadChart) {
        cpuLoadChart.updateSeries([{ data: chartData }], false);
        return;
    }

    cpuLoadChart = new ApexCharts(document.querySelector('#load-chart'), {
        chart: {
            type: 'area',
            height: 300,
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800,
            }
        },
        theme: { mode: 'dark' },
        series: [{ name: 'CPU Load', data: chartData }],
        stroke: { curve: 'smooth', width: 2.5 },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'vertical',
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.05,
                stops: [0, 100]
            }
        },
        colors: ['#1D9E75'],
        dataLabels: { enabled: false },
        xaxis: {
            type: 'datetime',
            labels: {
                style: { colors: '#475569', fontFamily: 'monospace', fontSize: '10px' },
                datetimeUTC: false,
                format: 'HH:mm'
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: '#475569', fontFamily: 'monospace', fontSize: '10px' },
                formatter: v => v.toFixed(0) + '%'
            }
        },
        grid: { show: false },
        tooltip: {
            theme: 'dark',
            x: { format: 'HH:mm' },
            y: { formatter: v => v.toFixed(1) + '%' }
        }
    });

    cpuLoadChart.render();
}



let comboChart = null;

async function loadComboChart(hours, btn) {
    document.querySelectorAll('.time-btn-combo').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const maxPoints = getMaxPoints(hours);

    const [loadResponse, tempResponse] = await Promise.all([
        fetch(`/history?graph=cpu&hours=${hours}`),
        fetch(`/history?graph=cputemp&hours=${hours}`)
    ]);

    const loadResult = await loadResponse.json();
    const tempResult = await tempResponse.json();

    if (!loadResult[0] || !tempResult[0]) return;

    const loadData = averagePoints(loadResult[0].data, maxPoints);
    const tempData = averagePoints(tempResult[0].data, maxPoints);

    if (comboChart) {
        comboChart.updateSeries([
            { data: loadData },
            { data: tempData }
        ], false);
        return;
    }

    comboChart = new ApexCharts(document.querySelector('#combo-chart'), {
        chart: {
            type: 'line',
            height: 300,
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: { enabled: true, easing: 'easeinout', speed: 800 }
        },
        theme: { mode: 'dark' },
        series: [
            { name: 'CPU Load', type: 'area', data: loadData },
            { name: 'Temperature', type: 'line', data: tempData }
        ],
        stroke: { curve: 'smooth', width: [2, 2] },
        fill: {
            type: ['gradient', 'solid'],
            gradient: {
                shade: 'dark',
                type: 'vertical',
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.05,
                stops: [0, 100]
            },
            opacity: [0.4, 1]
        },
        colors: ['#378ADD', '#E58B26'],
        dataLabels: { enabled: false },
        legend: {
            show: true,
            labels: { colors: '#475569' }
        },
        xaxis: {
            type: 'datetime',
            labels: {
                style: { colors: '#475569', fontFamily: 'monospace', fontSize: '10px' },
                datetimeUTC: false,
                format: 'HH:mm'
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: [
            {
                title: {
                    text: 'Load %',
                    style: { color: '#378ADD', fontFamily: 'monospace', fontSize: '10px' }
                },
                labels: {
                    style: { colors: '#378ADD', fontFamily: 'monospace', fontSize: '10px' },
                    formatter: v => v.toFixed(0) + '%'
                }
            },
            {
                opposite: true,
                min: 30,
                max: 80,
                title: {
                    text: 'Temperature °C',
                    style: { color: '#E58B26', fontFamily: 'monospace', fontSize: '10px' }
                },
                labels: {
                    style: { colors: '#E58B26', fontFamily: 'monospace', fontSize: '10px' },
                    formatter: v => v.toFixed(0) + '°C'
                }
            }
        ],
        grid: { show: false },
        tooltip: {
            theme: 'dark',
            shared: true,
            x: { format: 'HH:mm' }
        }
    });

    comboChart.render();
}





let liveTempChart = null;
const liveTempData = [];
const LIVE_MAX_POINTS = 60;

async function initLiveTempChart() {
    liveTempChart = new ApexCharts(document.querySelector('#live-temp-chart'), {
        chart: {
            type: 'line',
            height: 80,
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: { enabled: true, speed: 500 }
            },
            sparkline: { enabled: true }
        },
        series: [{ name: 'Temperature', data: [] }],
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#378ADD'],
        tooltip: {
            theme: 'dark',
            y: { formatter: v => v + '°C' }
        }
    });

    liveTempChart.render();

    // Load last 2 minutes of data
    const response = await fetch('/history?graph=cputemp&hours=0.1&live=true');
    const result = await response.json();
    if (result && result[0] && result[0].data) {
        result[0].data
        .filter((_, i) => i % 2 === 0)
        .forEach(point => {
            liveTempData.push({ x: point[0] * 1000, y: point[1] });
        });
        if (liveTempData.length > LIVE_MAX_POINTS) {
            liveTempData.splice(0, liveTempData.length - LIVE_MAX_POINTS);
        }
        liveTempChart.updateSeries([{ data: liveTempData }], false);
    }
}

function updateLiveTempChart(temp) {
    liveTempData.push({ x: Date.now(), y: temp });
    if (liveTempData.length > LIVE_MAX_POINTS) liveTempData.shift();

    document.getElementById('live-temp').textContent = temp;

    if (liveTempChart) {
        liveTempChart.updateSeries([{ data: liveTempData }], false);
    }
}

// Add to setInterval
setInterval(() => {
    const activeBtn = document.querySelector('.time-btn.active');
    const hours = activeBtn ? parseInt(activeBtn.textContent) : 1;
    loadChart(hours, activeBtn);

    const activeLoadBtn = document.querySelector('.time-btn-load.active');
    const loadHours = activeLoadBtn ? parseInt(activeLoadBtn.textContent) : 1;
    loadLoadChart(loadHours, activeLoadBtn);

    const activeComboBtn = document.querySelector('.time-btn-combo.active');
    const comboHours = activeComboBtn ? parseInt(activeComboBtn.textContent) : 1;
    loadComboChart(comboHours, activeComboBtn);
}, 30000);



function connectLiveTemp() {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (!data.realtime?.cpu?.cpu?.temp) return;
        updateLiveTempChart(data.realtime.cpu.cpu.temp);
    };

    ws.onclose = () => setTimeout(connectLiveTemp, 3000);
}

async function initAll() {
    await loadChart(1, document.querySelector('.time-btn'));
    await loadLoadChart(1, document.querySelector('.time-btn-load'));
    await loadComboChart(1, document.querySelector('.time-btn-combo'));
    await initLiveTempChart();
    connectLiveTemp();
}

initAll();