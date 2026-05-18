/**
 * cpu-apex.js - CPU Detail Page (ApexCharts)
 */

let tempChart = null;

function getMaxPoints(hours) {
    if (hours === 1) return 60;
    if (hours === 6) return 72;
    return 48;
}

async function loadChart(hours, btn) {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const response = await fetch(`/history?graph=cputemp&hours=${hours}`);
    const result = await response.json();

    if (!result || !result[0] || !result[0].data) return;

    const points = result[0].data;
    const maxPoints = getMaxPoints(hours);
    const step = Math.max(1, Math.floor(points.length / maxPoints));
    
    const sampled = [];
    for (let i = points.length - 1; i >= 0; i -= step) {
        sampled.unshift(points[i]);
        if (sampled.length >= maxPoints) break;
    }

    const chartData = sampled.map(point => ({ x: point[0] * 1000, y: point[1] }));

    if (tempChart) {
        tempChart.updateSeries([{ data: chartData }], false);
        return;
    }

    tempChart = new ApexCharts(document.querySelector('#temp-chart'), {
        chart: {
            type: 'area',
            height: 300,
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: { enabled: false }
        },
        theme: { mode: 'dark' },
        series: [{ name: 'Temperature', data: chartData }],
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'vertical',
                shadeIntensity: 0.5,
                opacityFrom: 0.5,
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

    console.log('points.length:', points.length);
console.log('step:', step);
console.log('first point:', sampled[0]);
console.log('last point:', sampled[sampled.length - 1]);
}

// Reload every 30 seconds
setInterval(() => {
    const activeBtn = document.querySelector('.time-btn.active');
    const hours = activeBtn ? parseInt(activeBtn.textContent) : 1;
    loadChart(hours, activeBtn);
}, 30000);

loadChart(1, document.querySelector('.time-btn'));