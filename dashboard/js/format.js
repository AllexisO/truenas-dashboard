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
