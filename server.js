require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// ⭐ CORS 設定 - 解決跨域問題
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 支援的城市列表（全台22縣市）
const CITY_MAP = {
  'taipei': '臺北市',
  'newtaipei': '新北市',
  'taoyuan': '桃園市',
  'taichung': '臺中市',
  'tainan': '臺南市',
  'kaohsiung': '高雄市',
  'keelung': '基隆市',
  'hsinchu-city': '新竹市',
  'hsinchu': '新竹縣',
  'miaoli': '苗栗縣',
  'changhua': '彰化縣',
  'nantou': '南投縣',
  'yunlin': '雲林縣',
  'chiayi-city': '嘉義市',
  'chiayi': '嘉義縣',
  'pingtung': '屏東縣',
  'yilan': '宜蘭縣',
  'hualien': '花蓮縣',
  'taitung': '臺東縣',
  'penghu': '澎湖縣',
  'kinmen': '金門縣',
  'lienchiang': '連江縣'
};

/**
 * 通用函數：取得指定城市天氣預報
 */
const getCityWeather = async (req, res, cityName) => {
  try {
    // 檢查是否有設定 API Key
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    console.log(`📡 正在取得 ${cityName} 的天氣資料...`);

    // 呼叫 CWA API - 一般天氣預報（36小時）
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName: cityName,
        },
      }
    );

    // 取得城市的天氣資料
    const locationData = response.data.records.location[0];

    if (!locationData) {
      return res.status(404).json({
        error: "查無資料",
        message: `無法取得${cityName}天氣資料`,
      });
    }

    // 整理天氣資料
    const weatherData = {
      city: locationData.locationName,
      updateTime: response.data.records.datasetDescription,
      forecasts: [],
    };

    // 解析天氣要素
    const weatherElements = locationData.weatherElement;
    const timeCount = weatherElements[0].time.length;

    for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
        weather: "",
        rain: "",
        minTemp: "",
        maxTemp: "",
        comfort: "",
        windSpeed: "",
      };

      weatherElements.forEach((element) => {
        const value = element.time[i].parameter;
        switch (element.elementName) {
          case "Wx":
            forecast.weather = value.parameterName;
            break;
          case "PoP":
            forecast.rain = value.parameterName + "%";
            break;
          case "MinT":
            forecast.minTemp = value.parameterName + "°C";
            break;
          case "MaxT":
            forecast.maxTemp = value.parameterName + "°C";
            break;
          case "CI":
            forecast.comfort = value.parameterName;
            break;
          case "WS":
            forecast.windSpeed = value.parameterName;
            break;
        }
      });

      weatherData.forecasts.push(forecast);
    }

    console.log(`✅ ${cityName} 天氣資料取得成功`);

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (error) {
    console.error(`❌ 取得${cityName}天氣資料失敗:`, error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "🌤️ 歡迎使用 CWA 天氣預報 API",
    supportedCities: Object.keys(CITY_MAP),
    totalCities: Object.keys(CITY_MAP).length,
    endpoints: {
      example: "/api/weather/taipei",
      allCities: "/api/weather/:city",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    supportedCities: Object.keys(CITY_MAP).length
  });
});

// 🌟 動態路由 - 支援所有22個縣市
app.get("/api/weather/:city", (req, res) => {
  const cityCode = req.params.city.toLowerCase();
  const cityName = CITY_MAP[cityCode];
  
  if (!cityName) {
    return res.status(400).json({ 
      error: "不支援的城市",
      message: `請使用以下城市代碼之一`,
      supportedCities: Object.keys(CITY_MAP),
      requestedCity: cityCode
    });
  }
  
  getCityWeather(req, res, cityName);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
    message: "請參考根路徑 / 查看可用的 API endpoints"
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器已啟動於 Port ${PORT}`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌍 支援 ${Object.keys(CITY_MAP).length} 個縣市`);
  console.log(`📡 API 端點: http://localhost:${PORT}/api/weather/:city`);
});