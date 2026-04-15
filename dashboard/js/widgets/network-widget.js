/**
 * network-widget.js - Network Widget Logic
 * 
 * Handles network interface card updates
 * including RX/TX rates and link status.
 */

function formatNetworkSpeed(bytesPerSecond) {
    let mbps = bytesPerSecond / 1048576;
    if (mbps >= 1) return mbps.toFixed(1) + " MB/s";
    let kbps = bytesPerSecond / 1024;
    if (kbps >= 1) return kbps.toFixed(1) + " KB/s";
    return Math.round(bytesPerSecond) + " B/s";
}

function updateNetwork(data) {
    if (!data.realtime || !data.realtime.interfaces) return;

    let networkRx = document.querySelector("#network-rx");
    if (!networkRx) return;

    let interfaces = data.realtime.interfaces;
    let interfaceName = Object.keys(interfaces)[0];
    if (!interfaceName) return;

    let iface = interfaces[interfaceName];

    let networkTx = document.querySelector("#network-tx");
    let networkSpeed = document.querySelector("#network-speed");
    let networkStatus = document.querySelector("#network-status");

    networkRx.textContent = formatNetworkSpeed(iface.received_bytes_rate);
    networkTx.textContent = formatNetworkSpeed(iface.sent_bytes_rate);
    networkSpeed.textContent = iface.speed + " Mbps";

    if (networkStatus) {
        let isUp = iface.link_state === "LINK_STATE_UP";
        networkStatus.textContent = isUp ? "Online" : "Offline";
        networkStatus.style.color = isUp ? "#34d399" : "#f43f5e";
    }
}