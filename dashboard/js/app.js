/**
 * app.js - Dashboard Frontend Logic
 * 
 * Connects to the WebSocket server and updates
 * the dashboard cards with real-time data.
 */

const WS_PORT = 8765;
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`;

function updateCPU(data) {
    if (!data.realtime || !data.realtime.cpu) return;

    const cpu = data.realtime.cpu;
    document.querySelector("#cpu-usage").textContent = Math.round(cpu.cpu.usage);
}

function connect() {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("Connected to TrueNAS Dashboard");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateCPU(data);
    };

    ws.onclose = () => {
        console.log('Disconnected, reconnecting in 3s ...');
        setTimeout(connect, 3000);
    }

    ws.onerror = (error) => {
        console.log("WebSocket error:", error);
    }
}

connect();
