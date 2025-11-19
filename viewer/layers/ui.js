import { hazardTypeToggle } from "./hazard.js";

export function createLayerToggleUI(layers) {
    console.log("[ui] Creating Layer Toggle UI");

    const container = document.createElement("div");
    container.id = "layer-toggle";
    container.style.cssText = `
        position:absolute;
        top:10px;
        left:10px;
        background:white;
        padding:10px;
        border-radius:6px;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
        font-size:14px;
        z-index:999;
        width: 180px;
    `;

    // -------------------------------------------
    // レイヤーの親チェックボックス（hazard, jiban…）
    // -------------------------------------------
    for (const key in layers) {
        const layerInfo = layers[key];

        const row = document.createElement("div");
        row.style.marginBottom = "6px";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `chk_${key}`;
        checkbox.style.marginRight = "4px";

        checkbox.addEventListener("change", () => {
            layerInfo.toggle(checkbox.checked);

            // hazard の場合のみ子チェックのON/OFFを反映
            if (key === "hazard") {
                const childChecks = container.querySelectorAll(".hazard-child");
                childChecks.forEach((c) => {
                    c.checked = checkbox.checked;
                    hazardTypeToggle(c.dataset.type, checkbox.checked);
                });
            }
        });

        const label = document.createElement("label");
        label.innerText = layerInfo.label;
        label.htmlFor = checkbox.id;

        row.appendChild(checkbox);
        row.appendChild(label);
        container.appendChild(row);

        // -------------------------------------------
        // hazard の子要素（flood, landslide, tsunami, liquefaction）
        // -------------------------------------------
        if (key === "hazard") {
            const hazards = [
                { type: "flood", label: "洪水" },
                { type: "landslide", label: "土砂" },
                { type: "tsunami", label: "津波" },
                { type: "liquefaction", label: "液状化" }
            ];

            const childContainer = document.createElement("div");
            childContainer.style.marginLeft = "20px";
            childContainer.style.marginBottom = "6px";

            hazards.forEach((hz) => {
                const childRow = document.createElement("div");
                childRow.style.marginBottom = "2px";

                const childCheckbox = document.createElement("input");
                childCheckbox.type = "checkbox";
                childCheckbox.classList.add("hazard-child");
                childCheckbox.dataset.type = hz.type;
                childCheckbox.style.marginRight = "4px";

                childCheckbox.addEventListener("change", () => {
                    hazardTypeToggle(hz.type, childCheckbox.checked);
                });

                const childLabel = document.createElement("label");
                childLabel.innerText = hz.label;
                childLabel.htmlFor = childCheckbox.id;

                childRow.appendChild(childCheckbox);
                childRow.appendChild(childLabel);
                childContainer.appendChild(childRow);
            });

            container.appendChild(childContainer);
        }
    }

    document.body.appendChild(container);
}
