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
