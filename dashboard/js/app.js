/**
 * app.js - Dashboard Frontend Logic
 * 
 * Connects to the WebSocket server and updates
 * the dashboard cards with real-time data.
 */

const WS_PORT = 8765;
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`;

function updateHeader(data) {
    if (!data.system) return;

    let serverVersion = document.querySelector("#server-version");
    let serverIp = document.querySelector("#server-ip");

    if (serverVersion) serverVersion.textContent = data.system.version;
    if (serverIp) {
        let _interface = data.interfaces?.[0]?.state?.aliases?.find(a => a.type === "INET");
        if (_interface) serverIp.textContent = _interface.address;
    }

    let uptime = document.querySelector("#server-uptime");
    let systemUptime = data.system.uptime;
    if (uptime && systemUptime) {
        uptime.textContent = "Uptime: " + formatUptime(systemUptime);
    }
}

function formatUptime(uptime) {
    let parts = uptime.split(", ");
    let days = parts.length > 1 ? parts[0] : "0 days";
    let time = parts.length > 1 ? parts[1].split(".")[0] : parts[0].split(".")[0];
    let [hours, minutes] = time.split(":");

    let d = parseInt(days);
    let h = parseInt(hours);
    let m = parseInt(minutes);

    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;

    return `${m}m`;
}

function initSettings(config) {
    let settingsBtn = document.querySelector("#settings-btn");
    let settingsPanel = document.querySelector("#settings-panel");
    let settingsClose = document.querySelector("#settings-close");
    let settingsSave = document.querySelector("#settings-save");

    document.querySelector("#settings-cpu").checked = config.widgets.cpu.enabled;
    document.querySelector("#settings-cpu-cores").checked = config.widgets.cpu.show_cores;

    settingsBtn.addEventListener("click", () => {
        settingsPanel.classList.add("open");
    });

    settingsClose.addEventListener("click", () => {
        settingsPanel.classList.remove("open");
    });

    settingsSave.addEventListener("click", async () => {
        config.widgets.cpu.enabled = document.querySelector("#setting-cpu").checked;
        config.widgets.cpu.show_cores = document.querySelector("#setting-cpu-cores").checked;

        await fetch("/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config)
        });

        settingsPanel.classList.remove("open");
        location.reload();
    });
}

function updateCPU(data) {
    if (!data.realtime || !data.realtime.cpu) return;

    let cpu = data.realtime.cpu;
    document.querySelector("#cpu-usage").textContent = Math.round(cpu.cpu.usage);

    updateCores(cpu);

    console.log(data);
}

function getCoreColor(usage) {
    if (usage > 80) return "#E24B4A";
    if (usage > 60) return "#BA7517";
    return "#378ADD";
}

function buildCoresGrid(cores) {
    let grid = document.querySelector("#cores-grid");

    if (!grid) return;

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

    let threadCount = Object.keys(cores).filter(key => key !== "cpu").length;
    let cpuThreads = document.querySelector("#cpu-threads");

    if (cpuThreads) {
        cpuThreads.textContent = threadCount + " threads";
    }
}

async function loadConfig() {
    const response = await fetch("/config");
    return await response.json();
}

function connect() {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("Connected to TrueNAS Dashboard");
        document.querySelector("#status-dot").className = "status-dot online";
        document.querySelector("#status-text").textContent = "Online";
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateHeader(data);
        updateCPU(data);
    };

    ws.onclose = () => {
        console.log('Disconnected, reconnecting in 3s ...');
        document.querySelector("#status-dot").className = "status-dot offline";
        document.querySelector("#status-text").textContent = "Offline";
        setTimeout(connect, 3000);
    }

    ws.onerror = (error) => {
        console.log("WebSocket error:", error);
    }
}

loadConfig().then(config => {
    initSettings(config);
    
    if (!config.widgets.cpu.enabled) {
        document.querySelector("#cpu-card").remove();
    }

    if (!config.widgets.cpu.show_cores) {
        document.querySelector("#cpu-cores-card").remove();
    }

    console.log(config)

    connect();
 });
