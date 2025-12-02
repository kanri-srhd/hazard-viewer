// ======================================================================
// ui-init.js - Google Maps風 UI コントロール
// ======================================================================

export function initUI(map) {
    const $ = id => document.getElementById(id);

    const searchIcon = $("search-icon");
    if (searchIcon) {
        const img = document.createElement("img");
        img.src = "./icons/search.svg";
        img.alt = "🔍";
        searchIcon.appendChild(img);
    }

    const menuBtn = $("menu-toggle");
    if (menuBtn) {
        const img = document.createElement("img");
        img.src = "./icons/menu.svg";
        img.alt = "☰";
        menuBtn.appendChild(img);
    }

    const zoomInBtn = $("zoom-in");
    if (zoomInBtn) {
        const img = document.createElement("img");
        img.src = "./icons/zoom_in.svg";
        img.alt = "+";
        zoomInBtn.appendChild(img);
        zoomInBtn.addEventListener("click", () => map.zoomIn({ duration: 300 }));
    }

    const zoomOutBtn = $("zoom-out");
    if (zoomOutBtn) {
        const img = document.createElement("img");
        img.src = "./icons/zoom_out.svg";
        img.alt = "−";
        zoomOutBtn.appendChild(img);
        zoomOutBtn.addEventListener("click", () => map.zoomOut({ duration: 300 }));
    }

    const geolocateBtn = $("geolocate");
    if (geolocateBtn) {
        const img = document.createElement("img");
        img.src = "./icons/locate.svg";
        img.alt = "📍";
        geolocateBtn.appendChild(img);
    }

    const clearPinsBtn = $("clear-pins");
    if (clearPinsBtn) {
        const img = document.createElement("img");
        img.src = "./icons/trash.svg";
        img.alt = "🗑";
        clearPinsBtn.appendChild(img);
    }

    const scale = new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: "metric"
    });
    map.addControl(scale, "bottom-left");
}
