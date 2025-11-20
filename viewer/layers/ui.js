export function createLayerToggleUI(defs) {
    const panel = document.getElementById("layer-control");
    panel.innerHTML = "<h3 style='margin-top:0;'>レイヤー</h3>";

    Object.keys(defs).forEach(key => {
        const row = document.createElement("div");
        row.style.marginBottom = "6px";

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.id = "chk-" + key;
        chk.onchange = () => defs[key].toggle(chk.checked);

        const lbl = document.createElement("label");
        lbl.setAttribute("for", "chk-" + key);
        lbl.textContent = defs[key].label;
        lbl.style.marginLeft = "4px";

        row.appendChild(chk);
        row.appendChild(lbl);
        panel.appendChild(row);
    });
}
