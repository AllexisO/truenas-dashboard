/**
 * app.js - Dashboard Entry Point
 * 
 * Main entry point for the dashboard.
 * Initializes all widgets and connects to WebSocket.
 */

const WS_PORT = 8765;
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`;

let appConfig = null;

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

async function loadConfig() {
    const response = await fetch("/config");
    const config = await response.json();
    return config;
}

function connect() {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("Connected to TrueNAS Dashboard");
        document.querySelector("#server-status-dot").className = "server-status-dot online";
        document.querySelector("#server-status-text").className = "server-status-text online";
        document.querySelector("#server-status-text").textContent = "Online";
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateHeader(data);
        updateLeds(data);
        updateCPU(data);
        updateCores(data.realtime?.cpu);
        updateRam(data);
        updateNetwork(data);

        console.log(data)
    };

    ws.onclose = () => {
        console.log('Disconnected, reconnecting in 3s ...');
        document.querySelector("#server-status-dot").className = "server-status-dot offline";
        document.querySelector("#server-status-text").className = "server-status-text offline";
        document.querySelector("#server-status-text").textContent = "Offline";
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

    if (config.widgets.memory.enabled) {
        createWidget('ram-card-template', 3);
    }

    if (config.widgets.memory.enabled) {
        createWidget('network-card-template', 4);
    }

    initTooltips();

    console.log(config)

    connect();
 });
