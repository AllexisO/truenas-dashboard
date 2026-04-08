/**
 * settings.js - Settings Panel Logic
 * 
 * Handles settings panel open/close and
 * saving widget configuration.
 */

function initSettings(config) {
    let settingsBtn = document.querySelector("#settings-btn");
    let settingsPanel = document.querySelector("#settings-panel");
    let settingsClose = document.querySelector("#settings-close");
    let settingsSave = document.querySelector("#settings-save");

    document.querySelector("#settings-cpu").checked = config.widgets.cpu.enabled;
    document.querySelector("#settings-cpu-cores").checked = config.widgets.cpu.show_cores;

    settingsBtn.addEventListener("click", () => {
        settingsPanel.classList.add("open");
    });

    settingsClose.addEventListener("click", () => {
        settingsPanel.classList.remove("open");
    });
    
    settingsSave.addEventListener("click", async () => {
        let newCpuEnabled = document.querySelector("#settings-cpu").checked;
        let newCpuCores = document.querySelector("#settings-cpu-cores").checked;

        /* CPU Card */
        if (newCpuEnabled && !appConfig.widgets.cpu.enabled) {
            createWidget("cpu-card-template", 1);
        } else if (!newCpuEnabled && appConfig.widgets.cpu.enabled) {
            destroyWidget("cpu-card");
        }

        /* CPU Cores Card */
        if (newCpuCores && !appConfig.widgets.cpu.show_cores) {
            createWidget("cpu-cores-card-template", 2);
        } else if (!newCpuCores && appConfig.widgets.cpu.show_cores) {
            destroyWidget("cpu-cores-card");
        }

        appConfig.widgets.cpu.enabled = newCpuEnabled;
        appConfig.widgets.cpu.show_cores = newCpuCores;
    
        await fetch('/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
                
        settingsPanel.classList.remove('open');
    });
}
