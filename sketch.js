let rainData = [];
let isLoading = true;
// 原始 API 網址
const targetUrl = "https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D";
// 透過 CORS 代理伺服器來繞過瀏覽器的 CORS 限制
const apiUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(targetUrl);

// Mappa.js 相關設定
let myMap;
let canvas;
const mappa = new Mappa('Leaflet');
const options = {
  lat: 25.05, // 台北市中心緯度
  lng: 121.54, // 台北市中心經度
  zoom: 12,
  style: "http://{s}.tile.osm.org/{z}/{x}/{y}.png"
};

function setup() {
  // 設定全螢幕畫面
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 建立地圖並將 p5 畫布疊加在其上
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas);
  
  // 首次載入資料
  loadRainData();
  
  // 設定每 10 分鐘 (10 * 60 * 1000 毫秒) 自動重新抓取一次資料
  setInterval(loadRainData, 600000);
}

// 將抓取資料的邏輯獨立成函式，方便重複呼叫
function loadRainData() {
  // 背景重新整理時不強制把 isLoading 設回 true，避免中斷使用者看地圖
  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      // API 實際的資料陣列通常存放在回傳物件的 data 屬性內
      rainData = data.data || [];
      isLoading = false;
    })
    .catch(error => {
      console.error("資料載入失敗:", error);
      isLoading = false;
    });
}

function draw() {
  // 使用 clear() 讓畫布背景透明，以顯示底下的地圖
  clear();
  
  if (isLoading) {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("資料載入中...", width / 2, height / 2);
    return;
  }

  let hoveredStation = null;

  // 迴圈顯示取得的雨量資料
  for (let i = 0; i < rainData.length; i++) {
    let station = rainData[i];
    
    // 取得經緯度 (依據 API 實際欄位名稱可能為 lat/lon, latitude/longitude 等)
    let lat = parseFloat(station.latitude || station.lat || station.lat_wgs84);
    let lon = parseFloat(station.longitude || station.lon || station.lon_wgs84);
    
    // 如果測站有提供經緯度，則在地圖上繪製標記
    if (!isNaN(lat) && !isNaN(lon)) {
      // 轉換經緯度為螢幕上的像素座標
      const pos = myMap.latLngToPixel(lat, lon);
      
      // 判斷滑鼠是否懸停在測站點上 (稍微放大半徑到 8，讓滑鼠更容易感應)
      let d = dist(mouseX, mouseY, pos.x, pos.y);
      if (d < 8) {
        hoveredStation = { station: station, pos: pos };
        fill(255, 50, 50, 220); // 懸停時圓點變成紅色
      } else {
        fill(0, 150, 255, 200); // 預設藍色
      }

      // 繪製測站標點
      noStroke();
      ellipse(pos.x, pos.y, 10, 10);
    }
  }

  // 在最上層繪製被懸停的測站資訊，避免被其他圓點遮蓋
  if (hoveredStation) {
    let station = hoveredStation.station;
    let pos = hoveredStation.pos;
    let rainAmt = station.rain || 0;
    let infoText = `${station.stationName} (${rainAmt}mm)`;

    textSize(14);
    let tw = textWidth(infoText);
    
    // 繪製半透明的文字背景框，增加閱讀性
    fill(255, 255, 255, 230);
    stroke(200);
    rect(pos.x + 10, pos.y - 12, tw + 12, 24, 5);

    // 在框內標示站名與雨量
    fill(0);
    noStroke();
    textAlign(LEFT, CENTER);
    text(infoText, pos.x + 16, pos.y);
  }
}

// 當視窗大小改變時，重新調整畫布大小維持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
