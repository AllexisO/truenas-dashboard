/**
 * processes-page.js - Processes Page Logic
 *
 * Minimal realtime hook for the standalone Processes page —
 * everything else (rings, sparklines) lives on Overview only.
 */
function handleRealtimeData(data) {
    if (data.processes) {
        buildProcessesTable(data.processes);
    }
}
