/**
 * alerts-widget.js - System Alerts Widget
 *
 * Lists active TrueNAS alerts (from alert.list) on the Overview page,
 * color-coded by severity. Rebuilt in full on every update — alerts come
 * and go individually with no stable per-row identity, unlike other
 * widgets' fixed-membership lists (disks, cores), so there's nothing
 * to key a diff-and-update pass on.
 */

function updateAlerts(data) {
    if (!data.alerts) return;

    let panel = document.getElementById("alerts-panel");
    let list = document.getElementById("alerts-list");
    let template = document.getElementById("alert-row-template");
    if (!panel || !list || !template) return;

    let alerts = data.alerts.filter(alert => !alert.dismissed);

    panel.hidden = alerts.length === 0;

    let servicesPanel = document.getElementById("services-panel");
    if (servicesPanel) servicesPanel.classList.toggle("panel-solo", alerts.length === 0);

    list.textContent = "";
    alerts.forEach(alert => {
        let clone = template.content.cloneNode(true);
        let row = clone.querySelector(".alert-row");

        let badge = row.querySelector(".alert-level-badge");
        badge.textContent = alert.level;
        badge.className = `alert-level-badge level-${(alert.level || "").toLowerCase()}`;

        row.querySelector(".alert-text").textContent = alert.text;

        list.appendChild(clone);
    });
}
