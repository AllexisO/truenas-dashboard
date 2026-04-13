ram-widget.js
/**
 * ram-widget.js - RAM Widget Logic
 * 
 * Handles RAM usage card updates including
 * physical memory and ZFS ARC cache.
 */

function formatBytes(bytes) {
    let gb = bytes / 1073741824;
    return gb.toFixed(1) + " GB";
}

function updateRam(data) {
    if (!data.realtime || !data.realtime.memory) return;
    

    let memory = data.realtime.memory;

    let total = memory.physical_memory_total;
    let available = memory.physical_memory_available;
    let used = Number(total) - Number(available);
    let arc = memory.arc_size;
    let usedPercent = (used / total) * 100;

    let ramTotal = document.querySelector("#ram-total");
    let ramTotalSidebar = document.querySelector("#sidebard-ram-total");

    let ramFree = document.querySelector("#ram-free");
    let ramFreeSedibar = document.querySelector("#sidebard-ram-free");

    let ramUsed = document.querySelector("#ram-used");
    let ramUsedSidebar = document.querySelector("#sidebard-ram-used");
    
    let ramArc = document.querySelector("#ram-arc");
    let ramArcSidebar = document.querySelector("#sidebard-ram-arc");

    let ramBar = document.querySelector("#ram-bar");

    if (!ramUsed) return;

    ramUsed.textContent = formatBytes(used);
    ramTotal.textContent = formatBytes(total);
    ramFree.textContent = formatBytes(available);
    ramArc.textContent = formatBytes(arc);
    ramBar.style.width = usedPercent.toFixed(0) + "%";

    ramTotalSidebar.textContent = formatBytes(total);
    ramFreeSedibar.textContent = formatBytes(available);
    ramUsedSidebar.textContent = formatBytes(used);
    ramArcSidebar.textContent = formatBytes(arc);
}