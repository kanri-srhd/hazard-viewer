import { parseInput } from "./utils/geocode.js";

// 地図初期化(大阪本社)
const map = new maplibregl.Map({
    container:"map",
    style:{
        "version":8,
        "sources":{
            "gsi-std":{
                "type":"raster",
                "tiles":[
                    "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
                ],
                "tileSize":256,
                "attribution":"© GSI"
            }
        },
        "layers":[
            {
                "id":"gsi-layer",
                "type":"raster",
                "source":"gsi-std"
            }
        ]
    },
    center:[135.5033,34.6863],
    zoom:15
});
window.map = map;

// 航空写真レイヤー
map.on("load",()=>{
    map.addSource("gsi-photo",{
        type:"raster",
        tiles:["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
        tileSize:256
    });

    map.addLayer({
        id:"gsi-photo-layer",
        type:"raster",
        source:"gsi-photo",
        layout:{visibility:"none"},
        paint:{"raster-opacity":0.4}
    });
});

// マーカー管理
let searchMarker = null;
let userMarker = null;

// ピン削除関数
function clearAllPins(){
    if(searchMarker){ searchMarker.remove(); searchMarker=null; }
    if(userMarker){ userMarker.remove(); userMarker=null; }
}
document.getElementById("clear-pins").onclick = clearAllPins;

// マップクリック → 青ピン
map.on("click", (e)=>{
    const {lng,lat} = e.lngLat;
    if(userMarker) userMarker.remove();
    userMarker = new maplibregl.Marker({color:"blue"})
        .setLngLat([lng,lat])
        .addTo(map);
});

// 右クリックで個別削除
map.on("contextmenu",(e)=>{});

// 住所検索(A方式:建物探索なし)
document.getElementById("search-btn").onclick = async ()=>{
    const val = document.getElementById("search-input").value.trim();
    if(!val) return;

    const pos = await parseInput(val);
    if(!pos){
        alert("位置を取得できませんでした");
        return;
    }

    // 赤ピン立てる
    if(searchMarker) searchMarker.remove();
    searchMarker = new maplibregl.Marker({color:"red"})
        .setLngLat([pos.lng,pos.lat])
        .addTo(map);

    // Google地図風ズーム
    map.flyTo({
        center:[pos.lng,pos.lat],
        zoom:17,
        speed:0.8
    });
};

// 航空写真 ON/OFF
document.getElementById("toggle-photo").onchange = (ev)=>{
    map.setLayoutProperty(
        "gsi-photo-layer",
        "visibility",
        ev.target.checked ? "visible":"none"
    );
};

// 航空写真透明度
document.getElementById("photo-opacity").oninput = (ev)=>{
    map.setPaintProperty("gsi-photo-layer","raster-opacity", parseFloat(ev.target.value));
};

// レイヤーパネルのサイズ調整
window.addEventListener("resize", () => {
    const panel = document.getElementById("layer-control");
    if (panel) {
        panel.style.maxHeight = (window.innerHeight - 200) + "px";
        panel.style.overflowY = "auto";
    }
});
