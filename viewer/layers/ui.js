export function createLayerToggleUI(layers) {
    console.log("[ui] Creating Layer Toggle UI");

    const container = document.createElement("div");
    container.id = "layer-toggle";
    container.style.cssText = `
        position:absolute;
        top:10px;
        left:10px;
        background:white;
        padding:8px;
        border-radius:6px;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
        font-size:14px;
        z-index:999;
    `;

    // 各レイヤーのトグルチェックボックス生成
    for (const key in layers) {
        const row = document.createElement("div");
        row.style.marginBottom = "4px";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `chk_${key}`;
        checkbox.style.marginRight = "4px";

        checkbox.addEventListener("change", () => {
            layers[key].toggle(checkbox.checked);
        });

        const label = document.createElement("label");
        label.innerText = layers[key].label;
        label.htmlFor = checkbox.id;

        row.appendChild(checkbox);
        row.appendChild(label);
        container.appendChild(row);
    }

    document.body.appendChild(container);
}
