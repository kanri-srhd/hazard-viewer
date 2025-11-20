import { hazardTypeToggle, setPrefCode } from "./hazard.js";

export function createLayerToggleUI(layers) {
    console.log("[ui] Creating Layer Toggle UI");

    const container = document.createElement("div");
    container.id = "layer-toggle";
    container.style.width = "100%";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "6px";
    container.style.fontSize = "14px";

    // -------------------------------------------
    // 都道府県セレクトボックス
    // -------------------------------------------
    const prefRow = document.createElement("div");
    prefRow.style.marginBottom = "10px";
    prefRow.style.paddingBottom = "10px";
    prefRow.style.borderBottom = "1px solid #ddd";

    const prefLabel = document.createElement("label");
    prefLabel.innerText = "都道府県: ";
    prefLabel.style.display = "block";
    prefLabel.style.marginBottom = "4px";
    prefLabel.style.fontWeight = "bold";

    const prefSelect = document.createElement("select");
    prefSelect.style.width = "100%";
    prefSelect.style.padding = "4px";
    prefSelect.style.fontSize = "13px";

    // オプション追加
    const prefectures = [
        { code: null, name: "全国版" },
        { code: 1, name: "北海道" },
        { code: 2, name: "青森県" },
        { code: 3, name: "岩手県" },
        { code: 4, name: "宮城県" },
        { code: 5, name: "秋田県" },
        { code: 6, name: "山形県" },
        { code: 7, name: "福島県" },
        { code: 8, name: "茨城県" },
        { code: 9, name: "栃木県" },
        { code: 10, name: "群馬県" },
        { code: 11, name: "埼玉県" },
        { code: 12, name: "千葉県" },
        { code: 13, name: "東京都" },
        { code: 14, name: "神奈川県" },
        { code: 15, name: "新潟県" },
        { code: 16, name: "富山県" },
        { code: 17, name: "石川県" },
        { code: 18, name: "福井県" },
        { code: 19, name: "山梨県" },
        { code: 20, name: "長野県" },
        { code: 21, name: "岐阜県" },
        { code: 22, name: "静岡県" },
        { code: 23, name: "愛知県" },
        { code: 24, name: "三重県" },
        { code: 25, name: "滋賀県" },
        { code: 26, name: "京都府" },
        { code: 27, name: "大阪府" },
        { code: 28, name: "兵庫県" },
        { code: 29, name: "奈良県" },
        { code: 30, name: "和歌山県" },
        { code: 31, name: "鳥取県" },
        { code: 32, name: "島根県" },
        { code: 33, name: "岡山県" },
        { code: 34, name: "広島県" },
        { code: 35, name: "山口県" },
        { code: 36, name: "徳島県" },
        { code: 37, name: "香川県" },
        { code: 38, name: "愛媛県" },
        { code: 39, name: "高知県" },
        { code: 40, name: "福岡県" },
        { code: 41, name: "佐賀県" },
        { code: 42, name: "長崎県" },
        { code: 43, name: "熊本県" },
        { code: 44, name: "大分県" },
        { code: 45, name: "宮崎県" },
        { code: 46, name: "鹿児島県" },
        { code: 47, name: "沖縄県" }
    ];

    prefectures.forEach(pref => {
        const option = document.createElement("option");
        option.value = pref.code === null ? "" : pref.code;
        option.innerText = pref.name;
        prefSelect.appendChild(option);
    });

    prefSelect.addEventListener("change", () => {
        const selectedCode = prefSelect.value === "" ? null : parseInt(prefSelect.value);
        console.log(`[ui] Prefecture changed: ${selectedCode}`);
        setPrefCode(selectedCode);
    });

    prefRow.appendChild(prefLabel);
    prefRow.appendChild(prefSelect);
    container.appendChild(prefRow);

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

            // hazard は必ず toggleLayer(show) を呼ぶ
            if (key === "hazard") {
                layers.hazard.toggle(checkbox.checked); // ← addHazardLayers が動く
                const childChecks = container.querySelectorAll(".hazard-child");
                childChecks.forEach((c) => {
                    c.checked = checkbox.checked;
                    hazardTypeToggle(c.dataset.type, checkbox.checked);
                });
                return;
            }

            // hazard 以外
            layerInfo.toggle(checkbox.checked);
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

    document.getElementById("layer-control").appendChild(container);
}
