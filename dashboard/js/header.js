/**
 * header.js - Header Logic
 * 
 * Handles header updates, uptime formatting,
 * LED indicators and tooltips.
 */

/* --- Header Logic --- */
function updateHeader(data) {
    if (!data.system) return;

    let serverVersion = document.querySelector("#server-version");
    let serverIp = document.querySelector("#server-ip");

    if (serverVersion) serverVersion.textContent = data.system.version;
    if (serverIp) {
        let alias = data.interfaces
            ?.flatMap(iface => iface.state?.aliases || [])
            .find(a => a.type === "INET");
        if (alias) serverIp.textContent = alias.address;
    }

    let uptime = document.querySelector("#server-uptime");
    let systemUptime = data.system.uptime;
    if (uptime && systemUptime) {
        uptime.textContent = formatUptime(systemUptime);
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

/* --- Animation for Logo --- */
function getLoadColor(percent) {
    if (percent < 50) return "var(--success)";
    if (percent < 70) return "#EAB308";
    return "var(--warning)";
}

function getBarColor(percent) {
    if (percent <= 50) return "var(--success)";
    if (percent <= 85) return "#EAB308";
    return "var(--warning)";
}

function getLedBlinkDuration(percent) {
    let ratio = Math.max(0, Math.min(percent, 100)) / 100;
    return 2.6 - (2.6 - 0.5) * ratio;
}

function getLedPeakScale(percent) {
    let ratio = Math.max(0, Math.min(percent, 100)) / 100;
    return 1.05 + (1.4 - 1.05) * ratio;
}

function setLiveBar(id, value) {
    let bar = document.getElementById(id);
    if (!bar) return;
    let percent = Math.max(0, Math.min(value, 100));
    bar.style.transform = `scaleX(${percent / 100})`;
    bar.style.fill = getBarColor(percent);
}

function setLiveLed(id, value, tooltip) {
    let led = document.getElementById(id);
    if (!led) return;
    let percent = Math.max(0, Math.min(value, 100));
    led.style.fill = getLoadColor(percent);
    led.style.setProperty("--led-duration", `${getLedBlinkDuration(percent).toFixed(2)}s`);
    led.style.setProperty("--led-peak-scale", getLedPeakScale(percent).toFixed(2));
    led.dataset.logoTooltip = tooltip;
}

function updateLogo(data) {
    if (!data.realtime) return;

    if (data.realtime.cpu) {
        let cpu = data.realtime.cpu.cpu || {};
        let usage = cpu.usage || 0;
        let temp = cpu.temp || 0;
        let coreUsages = Object.entries(data.realtime.cpu)
            .filter(([key]) => key !== "cpu")
            .map(([, core]) => core.usage || 0);
        let busiestCore = coreUsages.length ? Math.max(...coreUsages) : 0;

        setLiveBar("logo-cpu-usage-bar", usage);
        setLiveBar("logo-cpu-temp-bar", temp);
        setLiveBar("logo-cpu-core-bar", busiestCore);
        setLiveLed("logo-cpu-status-led", Math.max(usage, temp, busiestCore),
            `CPU ${Math.round(usage)}% · ${Math.round(temp)}°C · busiest core ${Math.round(busiestCore)}%`);
    }

    if (data.realtime.memory) {
        let memory = data.realtime.memory;
        let total = memory.physical_memory_total || 1;
        let available = memory.physical_memory_available || 0;
        let arc = memory.arc_size || 0;
        let usedPercent = ((total - available) / total) * 100;
        let arcPercent = (arc / total) * 100;
        let freePercent = (available / total) * 100;

        setLiveBar("logo-ram-usage-bar", usedPercent);
        setLiveBar("logo-ram-arc-bar", arcPercent);
        setLiveBar("logo-ram-free-bar", freePercent);
        setLiveLed("logo-ram-status-led", usedPercent,
            `RAM ${Math.round(usedPercent)}% used · ARC ${Math.round(arcPercent)}% · free ${Math.round(freePercent)}%`);
    }

    let interfaces = data.realtime.interfaces || {};
    let interfaceName = Object.keys(interfaces)[0];
    if (interfaceName) {
        let iface = interfaces[interfaceName];
        let maxBytesPerSecond = (iface.speed || 0) * 1000000 / 8;
        let rxPercent = maxBytesPerSecond ? (iface.received_bytes_rate / maxBytesPerSecond) * 100 : 0;
        let txPercent = maxBytesPerSecond ? (iface.sent_bytes_rate / maxBytesPerSecond) * 100 : 0;
        let totalPercent = maxBytesPerSecond ? ((iface.received_bytes_rate + iface.sent_bytes_rate) / maxBytesPerSecond) * 100 : 0;

        setLiveBar("logo-net-rx-bar", rxPercent);
        setLiveBar("logo-net-tx-bar", txPercent);
        setLiveBar("logo-net-total-bar", totalPercent);

        let isUp = iface.link_state === "LINK_STATE_UP";
        let led = document.getElementById("logo-net-status-led");
        if (led) {
            if (isUp) {
                setLiveLed("logo-net-status-led", totalPercent,
                    `${interfaceName}: RX ${Math.round(rxPercent)}% · TX ${Math.round(txPercent)}% of ${iface.speed} Mbps`);
            } else {
                led.style.fill = "var(--failed)";
                led.style.setProperty("--led-duration", `${getLedBlinkDuration(100).toFixed(2)}s`);
                led.style.setProperty("--led-peak-scale", getLedPeakScale(100).toFixed(2));
                led.dataset.logoTooltip = `${interfaceName}: link down`;
            }
        }
    }
}

function initTooltips() {
    let logoTooltip = document.getElementById('logo-tooltip');
    
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', (event) => {
            logoTooltip.textContent = el.dataset.logoTooltip;
            logoTooltip.style.display = 'block';
        });

        el.addEventListener('mousemove', (event) => {
            logoTooltip.style.left = (event.clientX + 12) + 'px';
            logoTooltip.style.top = (event.clientY + 12) + 'px';
        });

        el.addEventListener('mouseleave', () => {
            logoTooltip.style.display = 'none';
        });
    });
}
