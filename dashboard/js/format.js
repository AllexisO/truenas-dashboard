/**
 * format.js - Shared Formatting Helpers
 *
 * Byte-size formatting used across widgets on both the
 * current and new dashboard UI.
 */

function formatBytes(bytes, decimals = 1) {
    if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(decimals) + " TB";
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(decimals) + " GB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(decimals) + " MB";
    return (bytes / 1024).toFixed(decimals) + " KB";
}

// Relative "how long ago" for a Unix-epoch-seconds timestamp — used for the
// Pools table's Last Snapshot column, where the raw age (not a fixed date)
// is what actually signals whether a schedule is keeping up.
function formatAge(epochSeconds) {
    if (!epochSeconds) return "Never";
    let seconds = Math.max(0, (Date.now() / 1000) - epochSeconds);
    let days = Math.floor(seconds / 86400);
    if (days > 0) return days + "d ago";
    let hours = Math.floor(seconds / 3600);
    if (hours > 0) return hours + "h ago";
    let minutes = Math.floor(seconds / 60);
    if (minutes > 0) return minutes + "m ago";
    return "just now";
}
