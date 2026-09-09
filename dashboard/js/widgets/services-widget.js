/**
 * services-widget.js - System Services Widget
 *
 * Lists TrueNAS service states (ssh, smb, nfs, etc.) on the Overview page.
 * Built once via template clone, then only status/state text updated on
 * every later message — same convention as the other widgets.
 */

function updateServices(data) {
    if (!data.services) return;

    let list = document.getElementById("services-list");
    if (!list) return;

    let shouldBuildRows = list.children.length === 0;
    let template = shouldBuildRows ? document.getElementById("service-row-template") : null;

    data.services.forEach(service => {
        let row;

        if (shouldBuildRows) {
            let clone = template.content.cloneNode(true);
            list.appendChild(clone);
            row = list.children[list.children.length - 1];
            row.dataset.serviceName = service.name;
        } else {
            row = list.querySelector(`[data-service-name="${service.name}"]`);
        }

        if (!row) return;

        let running = service.state === "RUNNING";
        // Enabled-but-not-running is the only real problem here — a
        // service the user deliberately left off (enable: false) isn't a
        // warning, it's the expected state.
        let statusClass = running ? "running" : (service.enable ? "stopped" : "disabled");

        row.querySelector(".service-status-dot").className = `service-status-dot ${statusClass}`;
        row.querySelector(".service-name").textContent = service.name.toUpperCase();
        row.querySelector(".service-state").textContent = running ? "Running" : (service.enable ? "Stopped" : "Disabled");
    });
}
