/**
 * app.js - Dashboard Entry Point
 * 
 * Main entry point for the dashboard.
 * Initializes all widgets and connects to WebSocket.
 */

const WS_PORT = 8765;
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`;

const getThemeToggle = document.querySelector("#theme-toggle");
const getCollpseToogle = document.querySelector("#sidebar-toggle");
const getAccentToggle = document.querySelector("#accent-toggle");

const html = document.documentElement;

let appConfig = null;

// Server now sends only changed keys per message (delta broadcast),
// so we merge each message into the running state instead of replacing it.
let latestData = {};

/* --- Theme Toogle --- */
function themeToggle() {
    getThemeToggle.addEventListener("click", () => {
        let current = html.getAttribute("data-theme");
        let next = current === "dark" ? "light" : "dark";

        html.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
    });
}

/* --- Accent Color Picker --- */
function applyCustomAccent(hex, colorInput) {
    html.removeAttribute("data-palette");
    localStorage.removeItem("accentPalette");

    html.style.setProperty("--user-accent", hex);
    html.setAttribute("data-accent", "custom");
    localStorage.setItem("accentColor", hex);
    colorInput.value = hex;
}

function markActiveChip(presetGrid, key) {
    presetGrid.querySelectorAll(".accent-preset-chip").forEach(chip => {
        chip.classList.toggle("active", chip.dataset.paletteKey === key);
    });
}

function applyPalette(key, representativeColor, colorInput, presetGrid) {
    html.removeAttribute("data-accent");
    html.style.removeProperty("--user-accent");
    localStorage.removeItem("accentColor");

    html.setAttribute("data-palette", key);
    localStorage.setItem("accentPalette", key);
    colorInput.value = representativeColor;
    markActiveChip(presetGrid, key);
}

function accentPicker() {
    const popover = document.querySelector("#accent-popover");
    const colorInput = document.querySelector("#accent-color-input");
    const defaultButton = document.querySelector("#accent-default");
    const presetGrid = document.querySelector("#accent-preset-grid");

    const savedPalette = localStorage.getItem("accentPalette");
    const savedAccent = localStorage.getItem("accentColor");
    if (savedAccent) {
        colorInput.value = savedAccent;
    } else if (savedPalette) {
        const activeSwatch = presetGrid.querySelector(`[data-palette-key="${savedPalette}"]`);
        if (activeSwatch) colorInput.value = activeSwatch.dataset.accentColor;
        markActiveChip(presetGrid, savedPalette);
    }

    getAccentToggle.addEventListener("click", () => {
        popover.classList.toggle("open");
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".topbar-accent-picker")) {
            popover.classList.remove("open");
        }
    });

    colorInput.addEventListener("input", () => {
        applyCustomAccent(colorInput.value, colorInput);
        markActiveChip(presetGrid, null);
    });

    presetGrid.addEventListener("click", (event) => {
        const chip = event.target.closest(".accent-preset-chip");
        if (!chip) return;
        applyPalette(chip.dataset.paletteKey, chip.dataset.accentColor, colorInput, presetGrid);
    });

    defaultButton.addEventListener("click", () => {
        html.removeAttribute("data-accent");
        html.removeAttribute("data-palette");
        html.style.removeProperty("--user-accent");
        localStorage.removeItem("accentColor");
        localStorage.removeItem("accentPalette");
        colorInput.value = "#06B6D4";
        markActiveChip(presetGrid, null);
        popover.classList.remove("open");
    });
}

/* --- Sidebar Collapse --- */
function collapseToggle() {
    getCollpseToogle.addEventListener("click", () => {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;

        if (isMobile) {
            const isOpen = html.getAttribute("data-mobile-sidebar") === "open";
            if (isOpen) {
                html.removeAttribute("data-mobile-sidebar");
            } else {
                html.setAttribute("data-mobile-sidebar", "open");
            }
            return;
        }

        let isCollapsedSidebar = html.getAttribute("data-sidebar") === "collapsed";

        if (isCollapsedSidebar) {
            html.removeAttribute("data-sidebar");
            localStorage.setItem("sidebar", "expanded");
        } else {
            html.setAttribute("data-sidebar", "collapsed");
            localStorage.setItem("sidebar", "collapsed");
        }
    });
}

const sidebarOverlay = document.querySelector("#sidebar-overlay");
if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
        html.removeAttribute("data-mobile-sidebar");
    });
}

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
        Object.assign(latestData, JSON.parse(event.data));

        updateHeader(latestData);
        updateLeds(latestData);
        if (typeof handleRealtimeData === 'function') handleRealtimeData(latestData);
        if (typeof updateCPU === 'function') updateCPU(latestData);
        if (typeof updateCores === 'function') updateCores(latestData.realtime?.cpu);
        if (typeof updateRam === 'function') updateRam(latestData);
        if (typeof updateNetwork === 'function') updateNetwork(latestData);
        if (typeof updateDisks === 'function') updateDisks(latestData);
        if (typeof buildPoolsSidebar === 'function') buildPoolsSidebar(latestData);

        console.log(latestData);
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

    if (typeof initSettings === 'function') initSettings(config);

    if (config.widgets.cpu.enabled) {
        createWidget('cpu-card-template', 1);
    }

    if (config.widgets.cpu.show_cores) {
        createWidget('cpu-cores-card-template', 2);
    }

    if (config.widgets.memory.enabled) {
        createWidget('ram-card-template', 3);
    }

    if (config.widgets.network.enabled) {
        createWidget('network-card-template', 4);
    }

    if (config.widgets.disks.enabled) {
        createWidget('disks-card-template', 5);
    }

    initTooltips();

    if (getThemeToggle) themeToggle();
    if (getCollpseToogle) collapseToggle();
    if (getAccentToggle) accentPicker();

    document.querySelectorAll(".sidebar-nav-item[data-href]").forEach(item => {
        item.addEventListener("click", () => {
            window.location.href = item.dataset.href;
        });
    });

    connect();
 });
