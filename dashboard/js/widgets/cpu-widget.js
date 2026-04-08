/**
 * cpu.js - CPU Widget Logic
 * 
 * Handles CPU usage card updates.
 */

/* --- CPU Loader Preview --- */
function updateCPU(data) {
    if (!data.realtime || !data.realtime.cpu) return;

    let cpu = data.realtime.cpu;
    let cpuUsage = document.querySelector("#cpu-usage");
    if (cpuUsage) cpuUsage.textContent = Math.round(cpu.cpu.usage);

    updateCores(cpu);
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
