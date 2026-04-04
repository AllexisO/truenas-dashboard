/**
 * app.js - Dashboard Frontend Logic
 * 
 * Connects to the WebSocket server and updates
 * the dashboard cards with real-time data.
 */

const WS_PORT = 8765;
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`;

function updateCPU(data) {
    if (!data.realtime || !data.realtime.cpu) return;

    const cpu = data.realtime.cpu;
    document.querySelector("#cpu-usage").textContent = Math.round(cpu.cpu.usage);

    updateCores(cpu);

    // console.log(data);
}

function getCoreColor(usage) {
    if (usage > 80) return "#E24B4A";
    if (usage > 60) return "#BA7517";
    return "#378ADD";
}

function buildCoresGrid(cores) {
    const grid = document.querySelector("#cores-grid");
    if (grid.children.length > 0) return;

    const template = document.querySelector("#core-template");

    Object.keys(cores).forEach(key => {
        if (key === "cpu") return;

        const clone = template.content.cloneNode(true);
        clone.querySelector(".core-name").textContent = "C" + (parseInt(key.replace("cpu", "")) + 1);
        clone.querySelector(".core-pct").id = `pct-${key}`;
        clone.querySelector(".core-bar").id = `bar-${key}`;
        grid.appendChild(clone);
    })
}

function updateCores(cores) {
    buildCoresGrid(cores);

    Object.keys(cores).forEach(key => {
        if (key === "cpu") return;

        const usage = Math.round(cores[key].usage);
        const color = getCoreColor(usage);

        const bar = document.getElementById(`bar-${key}`);
        const pct = document.getElementById(`pct-${key}`);

        if (bar) {
            bar.style.width = usage + "%";
            bar.style.backgroundColor = color;
        }

        if (pct) {
            pct.textContent = usage + "%";
            pct.style.color = color;
        }
    });

    const threadCount = Object.keys(cores).filter(key => key !== "cpu").length;
    document.querySelector("#cpu-threads").textContent = threadCount + " threads";
}

async function loadConfig() {
    const response = await fetch("/config");
    return await response.json();
}

function connect() {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("Connected to TrueNAS Dashboard");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateCPU(data);
    };

    ws.onclose = () => {
        console.log('Disconnected, reconnecting in 3s ...');
        setTimeout(connect, 3000);
    }

    ws.onerror = (error) => {
        console.log("WebSocket error:", error);
    }
}

loadConfig().then(config => {
    if (!config.widgets.cpu.enabled) {
        document.querySelector("#cpu-card").remove();
    }

    if (!config.widgets.cpu.show_cores) {
        document.querySelector("#cpu-cores-card").remove();
    }

    console.log(config)

    connect();
 });
