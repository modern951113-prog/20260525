let rainData = [];
let isLoading = true;
let dataLoadError = null; // 用於儲存載入錯誤的資訊
// 原始 API 網址
const targetUrl = "https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D"; // 台北市雨量資料 API
// 透過 CORS 代理伺服器來繞過瀏覽器的 CORS 限制
// 免費的 CORS 代理服務有時會不穩定。如果目前的代理失效，可以嘗試註解掉它，並啟用下一個。
// const apiUrl = "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(targetUrl); // 這個目前回報 400 錯誤
const apiUrl = "https://corsproxy.io/?" + targetUrl; // 備用代理 1
// const apiUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(targetUrl); // 備用代理 2

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
  
  // 【功能一】首次載入資料
  // 程式開始時，先呼叫一次 loadRainData() 來獲取初始資料。
  loadRainData();
  
  // 【功能一】設定每 10 分鐘自動重新抓取資料
  // setInterval 是一個 JavaScript 函式，它會以指定的時間間隔（此處為 10 分鐘）重複呼叫一個函式。
  // 10 分鐘 = 10 * 60 秒 * 1000 毫秒 = 600000 毫秒
  setInterval(loadRainData, 600000);
}

// 將抓取資料的邏輯獨立成函式，方便重複呼叫
function loadRainData() {
  dataLoadError = null; // 每次重新載入時，重置錯誤狀態
  // 背景重新整理時不強制把 isLoading 設回 true，避免中斷使用者看地圖
  fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        // 處理 HTTP 錯誤 (例如 404, 503)，fetch 預設不會將其視為網路錯誤
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // API 實際的資料陣列通常存放在回傳物件的 data 屬性內
      rainData = data.data || [];
      isLoading = false;
    })
    .catch(error => {
      console.error("資料載入失敗:", error);
      // 將錯誤資訊存起來，以便在畫面上顯示
      dataLoadError = error;
      isLoading = false;
    });
}

/**
 * 根據雨量數值回傳對應的顏色
 * @param {number} rain - 雨量 (mm)
 * @returns {p5.Color} p5.js 顏色物件
 */
function getRainfallColor(rain) {
  // 根據中央氣象署24小時累積雨量標準
  if (rain >= 500) {
    return color(153, 0, 153); // 超大豪雨 (紫色)
  } else if (rain >= 350) {
    return color(255, 0, 0);     // 大豪雨 (紅色)
  } else if (rain >= 200) {
    return color(255, 165, 0);   // 豪雨 (橘色)
  } else if (rain >= 80) {
    return color(255, 255, 0);   // 大雨 (黃色)
  } else {
    return color(0, 150, 255, 200); // 預設藍色 (小於大雨)
  }
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

  // 如果載入時發生錯誤，在畫面上顯示錯誤訊息
  if (dataLoadError) {
    fill(255, 0, 0); // 紅色文字
    textAlign(CENTER, CENTER);
    textSize(18);
    text('雨量資料載入失敗，請檢查主控台(F12)的錯誤訊息。', width / 2, height / 2);
    // 顯示更詳細的錯誤類型
    text(dataLoadError.message, width / 2, height / 2 + 30);
    return;
  }

  // 如果沒有錯誤，但資料是空的，也顯示提示
  if (rainData.length === 0) {
    fill(100);
    textAlign(CENTER, CENTER);
    textSize(18);
    text('API 未回傳任何觀測站資料。', width / 2, height / 2);
    return;
  }


  // 建立一個隨時間變化的值，用於製作脈衝動畫效果
  // (1 + sin(frameCount * 0.1)) 的範圍是 0 到 2，乘以 3 後範圍是 0 到 6
  const pulseSize = (1 + sin(frameCount * 0.1)) * 3;

  // 【功能二】滑鼠懸停效果
  // 1. 每一幀開始時，先假設沒有任何測站被滑鼠懸停。
  let hoveredStation = null;

  // 迴圈顯示取得的雨量資料
  for (let i = 0; i < rainData.length; i++) {
    let station = rainData[i];
    // 2. 在迴圈中，檢查滑鼠是否在某個測站的範圍內。
    //    我們只記錄「最後一個」被滑鼠懸停的測站。
    
    // 取得經緯度 (依據 API 實際欄位名稱可能為 lat/lon, latitude/longitude 等)
    let lat = parseFloat(station.latitude || station.lat || station.lat_wgs84);
    let lon = parseFloat(station.longitude || station.lon || station.lon_wgs84);
    
    // 如果測站有提供經緯度，則在地圖上繪製標記
    if (!isNaN(lat) && !isNaN(lon)) {
      // 轉換經緯度為螢幕上的像素座標
      const pos = myMap.latLngToPixel(lat, lon);
      const rainAmt = parseFloat(station.rain || 0);
      const stationColor = getRainfallColor(rainAmt);
      
      // 判斷滑鼠是否懸停在測站點上 (稍微放大半徑到 8，讓滑鼠更容易感應)
      let d = dist(mouseX, mouseY, pos.x, pos.y); // dist() 計算兩點間的距離
      if (d < 10) { // 增加感應半徑以匹配較大的圖示
        hoveredStation = { station: station, pos: pos };
      }

      // 繪製脈衝光暈，讓測站更醒目
      noStroke();
      // 使用測站顏色，但透明度較低
      fill(stationColor.levels[0], stationColor.levels[1], stationColor.levels[2], 70);
      ellipse(pos.x, pos.y, 18 + pulseSize, 18 + pulseSize);

      // 根據是否被滑鼠懸停來決定圓點樣式
      if (hoveredStation && hoveredStation.station.stationNo === station.stationNo) {
        // 懸停時的樣式：白色外框，讓圓點更突出
        stroke(255);
        strokeWeight(3); // 加粗
        fill(stationColor);
      } else {
        // 一般樣式：加上深灰色外框，增加可視性
        stroke(50); // 深灰色
        strokeWeight(1.5);
        fill(stationColor);
      }

      // 繪製測站標點
      ellipse(pos.x, pos.y, 18, 18); // 再次放大圖示
    }
  }

  // 【功能二】繪製懸停資訊
  // 3. 在所有測站的圓點都畫完之後，才檢查 hoveredStation 是否有被賦值。
  //    如果有，代表滑鼠正懸停在某個測站上，此時才繪製該站的詳細資訊框。
  //    這樣可以確保資訊框永遠顯示在所有圓點的最上層。
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
