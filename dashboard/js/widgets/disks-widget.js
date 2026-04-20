/**
 * disks-widget.js - Disks Widget Logic
 *
 * Handles disk cards with temperature, usage and model info.
 * Combines data from disk.query, disk.temperatures and pool.query.
 */

function formatDiskSize(bytes) {
    let tb = bytes / 1099511627776;
    if (tb >= 1) return tb.toFixed(1) + " TB";
    
    let gb = bytes / 1073741824;
    return gb.toFixed(0) + " GB";
}

function getDiskColor(percent) {
    if (percent >= 90) return "#E24B4A";
    if (percent >= 60) return "#BA7517";
    return "#1D9E75";
}

function getTempColor(temp) {
    if (temp >= 55) return "#E24B4A"
    if (temp >= 45) return "#BA7517";
    return "#1D9E75";
}

function buildDiskGrid(data) {
    let grid = document.querySelector("#disks-grid");
    if (!grid) return;
    if (grid.children.length > 0) return;

    let disks = data.disks;
    let pools = data.pools;
    let temps = data.disk_temps;

    if (!disks || !disks.length) return;

    const template = document.querySelector("#disk-item-template");

    // Build map of disk -> pool usage via zfs_guid
    const diskUsageMap = {};
    if (pools) {
        pools.forEach(pool => {
            let walkVdevs = (vdevs) => {
                vdevs.forEach(vdev => {
                    if (vdev.disk) {
                        diskUsageMap[vdev.disk] = {
                            allocated: pool.allocated,
                            size: pool.size,
                            pool: pool.name
                        };
                    }
                    if (vdev.children) walkVdevs(vdev.children);
                });
            };
            if (pool.topology?.data) walkVdevs(pool.topology.data);
        });
    }

    disks.forEach(disk => {
        let clone = template.content.cloneNode(true);
        let item = clone.querySelector(".disk-item");

        let usage = diskUsageMap[disk.name];

        // For boot disk use df data
        if (!usage && data.boot_disks?.includes(disk.name) && data.boot_disk) {
            usage = {
                allocated: data.boot_disk.used,
                size: data.boot_disk.total,
                pool: "boot"
            };
        }
        
        let temp = temps?.[disk.name];
        let percent = usage ? Math.round((usage.allocated / usage.size) * 100) : null;
        let color = percent !== null ? getDiskColor(percent) : "#475569";

        clone.querySelector(".disk-name").textContent = disk.name;
        clone.querySelector(".disk-model").textContent = disk.model?.replace(/_/g," ") || "Unknown";
        clone.querySelector(".disk-type").textContent = disk.type;

        const tempEl = clone.querySelector(".disk-temp");
        if (temp !== null && temp !== undefined) {
            tempEl.textContent = temp + "°";
            tempEl.style.color = getTempColor(temp);
        } else {
            tempEl.textContent = "--";
        }

        const bar = clone.querySelector(".disk-bar");
        bar.style.width = (percent || 0) + "%";
        bar.style.background = color;

        clone.querySelector(".disk-allocated").textContent = usage ? formatDiskSize(usage.allocated) : "--";
        clone.querySelector(".disk-size").textContent = formatDiskSize(disk.size);

        item.dataset.diskName = disk.name;
        grid.appendChild(clone);
    });

    let count = document.querySelector(".disk-count");
    if (count) count.textContent = disk.length + " disks";
}

function buildPoolsSidebar(data) {
    console.log('buildPoolsSidebar called');
    console.log('pools:', data.pools);

    let grid = document.querySelector("#disks-sidebar-grid");
    console.log('grid:', grid);
    if (!grid) return;
    if (grid.children.length > 0) return;

    const pools = data.pools;
    if (!pools || !pools.length) return;

    const template = document.querySelector("#pool-sidebar-item-template");
    pools.forEach(pool => {
        let percent = Math.round((pool.allocated / pool.size) * 100);
        let color = getDiskColor(percent);

        const clone = template.content.cloneNode(true);

        clone.querySelector(".pool-sidebar-name").textContent = pool.name;
        clone.querySelector(".pool-sidebar-percent").textContent = percent + "%";
        clone.querySelector(".pool-sidebar-percent").style.color = color;
        clone.querySelector(".pool-sidebar-bar").style.width =  percent + "%";
        clone.querySelector(".pool-sidebar-bar").style.background = color;
        clone.querySelector(".pool-sidebar-used").textContent = formatDiskSize(pool.allocated);
        clone.querySelector(".pool-sidebar-size").textContent = formatDiskSize(pool.size);

        grid.appendChild(clone);
    });
}

function updateDisks(data) {
    if (!data.disks) return;
    const grid = document.querySelector("#disks-grid");
    if (!grid) return;

    buildDiskGrid(data);

    // Update temperatures
    if (data.disk_temps) {
        Object.entries(data.disk_temps).forEach(([name, temp]) => {
            let item = grid.querySelector(`[data-disk-name="${name}"]`);
            if (!item) return;

            const tempEl = item.querySelector(".disk-temp");
            if (tempEl) {
                tempEl.textContent = temp + "°";
                tempEl.style.color = getTempColor(temp);
            }
        });
    }
}