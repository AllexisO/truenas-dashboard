/**
 * app.js - Dashboard Frontend Logic
 * 
 * Connects to the WebSocket server and updates
 * the dashboard cards with real-time data.
 */

const WS_PORT = 8765;
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`;

let appConfig = null;

/* --- Animation for Logo --- */
function getLedColor(percent) {
    let ratio, r, g, b;

    if (percent <= 50) {
        ratio = percent / 50;
        r = Math.round(29 + (239 - 29) * ratio);
        g = Math.round(158 + (159 - 158) * ratio);
        b = Math.round(117 + (39 - 117) * ratio);
        return `rgb(${r},${g},${b})`;
    } else {
        ratio = (percent - 50) / 50;
        r = Math.round(239 + (233 - 239) * ratio);
        g = Math.round(159 + (74 - 159) * ratio);
        b = Math.round(39 + (30 - 39) * ratio);
        return `rgb(${r},${g},${b})`;
    }
}

function updateLeds(data) {
    if (!data.realtime) return;

    let cpu = data.realtime.cpu?.cpu?.usage || 0;
    let memoryTotal = data.realtime.memory?.physical_memory_total || 1;
    let memoryAvailable = data.realtime.memory?.physical_memory_available || 0;
    let ram = ((memoryTotal - memoryAvailable) / memoryTotal) * 100;
    let disk = data.realtime.disks?.busy || 0;
    let netMax = 1000 * 1024 * 1024 / 8;
    let netRx = data.realtime.interfaces?.eno1?.received_bytes_rate || 0;
    let netTx = data.realtime.interfaces?.eno1?.sent_bytes_rate || 0;
    let network = ((netRx - netTx) / netMax) * 100;

    const leds = {
        "led-cpu": { value: cpu, label: "CPU" },
        "led-ram": { value: ram, label: "RAM" },
        "led-disk": { value: disk, label: "Disks" },
        "led-network": { value: network, label: "Network" }
    };

    Object.entries(leds).forEach(([id, info]) => {
        let led = document.getElementById(id);
        if (!led) return;
        led.style.fill = getLedColor(info.value);
        led.dataset.tooltip = `${info.label}: ${Math.round(info.value)}%`;
    });
}
function initTooltips() {
    const tooltip = document.getElementById('tooltip');
    
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', (event) => {
            tooltip.textContent = el.dataset.tooltip;
            tooltip.style.display = 'block';
        });

        el.addEventListener('mousemove', (event) => {
            tooltip.style.left = (event.clientX + 12) + 'px';
            tooltip.style.top = (event.clientY + 12) + 'px';
        });

        el.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    });
}

/* --- Widget Creation Logic --- */
function createWidget(templateId, order) {
    const template = document.getElementById(templateId);
    if(!template) return;

    const clone = template.content.cloneNode(true);
    const cards = document.querySelector("#cards");

    let firstChild = clone.firstElementChild;
    if (firstChild) firstChild.dataset.order = order;

    const allCards = [...cards.children];
    const insertBefore = allCards.find(card => parseInt(card.dataset.order) > order);

    if (insertBefore) {
        cards.insertBefore(clone, insertBefore);
    } else {
        cards.appendChild(clone);
    }
}

function destroyWidget(cardId) {
    const card = document.getElementById(cardId);
    if (card) card.remove();
}

/* --- Header Logic --- */
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

/* --- Uptime Logic --- */
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

/* --- Settings Logic --- */
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
        let newCpuEnabled = document.querySelector("#settings-cpu").checked;
        let newCpuCores = document.querySelector("#settings-cpu-cores").checked;

        // CPU Card
        if (newCpuEnabled && !appConfig.widgets.cpu.enabled) {
            createWidget("cpu-card-template", 1);
        } else if (!newCpuEnabled && appConfig.widgets.cpu.enabled) {
            destroyWidget("cpu-card");
        }

        // CPU Cores Card
        if (newCpuCores && !appConfig.widgets.cpu.show_cores) {
            createWidget("cpu-cores-card-template", 2);
        } else if (!newCpuCores && appConfig.widgets.cpu.show_cores) {
            destroyWidget("cpu-cores-card");
        }

        appConfig.widgets.cpu.enabled = newCpuEnabled;
        appConfig.widgets.cpu.show_cores = newCpuCores;
    
        await fetch('/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
                
        settingsPanel.classList.remove('open');
        // location.reload();
    });
}

/* --- CPU Loader Preview --- */
function updateCPU(data) {
    if (!data.realtime || !data.realtime.cpu) return;

    let cpu = data.realtime.cpu;
    let cpuUsage = document.querySelector("#cpu-usage");
    if (cpuUsage) cpuUsage.textContent = Math.round(cpu.cpu.usage);

    updateCores(cpu);

    // console.log(data);
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
    if (!appConfig || !appConfig.widgets.cpu.show_cores) return;

    let grid = document.querySelector("#cores-grid");
    if (!grid) return;

    buildCoresGrid(cores);

    Object.keys(cores).forEach(key => {
        if (key === "cpu") return;

        let usage = Math.round(cores[key].usage);
        let color = getCoreColor(usage);

        let bar = document.getElementById(`bar-${key}`);
        let pct = document.getElementById(`pct-${key}`);

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
    const config = await response.json();
    return config;
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
        updateLeds(data);
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
    appConfig = config;

    initSettings(config);

    if (config.widgets.cpu.enabled) {
        createWidget('cpu-card-template', 1);
    }

    if (config.widgets.cpu.show_cores) {
        createWidget('cpu-cores-card-template', 2);
    }

    initTooltips();

    // console.log(config)

    connect();
 });
