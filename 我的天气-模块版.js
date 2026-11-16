// ============================================================
//  我的天气 · Egern 小号方块组件
//  由 Scriptable 脚本转换而来
//  脚本类型：generic
// ============================================================

// ---------------- 字号设置（只改这里）----------------
const TEMP_FONT_SIZE = 48;   // 当前实时温度
const RANGE_FONT_SIZE = 18;  // 最高 / 最低温度
const DEGREE_FONT_SIZE = 16; // ° 符号

// ---------------- 地区设置 ----------------
// 城市和县填模块 Env（CITY / AREA），经纬度由脚本自动解析
const DEFAULT_CITY = "";
const DEFAULT_AREA = "";

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

// ---------------- 配色（和其他组件统一：纯黑底 + 彩色强调）----------------
const COLOR_REGION_ICON = "#0A84FF"; // 地区图标：蓝
const COLOR_MAX = "#FF9F0A";         // 最高温：橙
const COLOR_MIN = "#0A84FF";         // 最低温：蓝

// 天气图标和颜色
function weatherStyle(code) {
  if (code === 0) return { symbol: "sun.max.fill", color: "#FFD60A" };
  if (code === 1) return { symbol: "cloud.sun.fill", color: "#FFD60A" };
  if (code === 2) return { symbol: "cloud.sun.fill", color: "#64D2FF" };
  if (code === 3) return { symbol: "cloud.fill", color: "#8E8E93" };
  if (code === 45 || code === 48) return { symbol: "cloud.fog.fill", color: "#98989D" };
  if (code >= 51 && code <= 57) return { symbol: "cloud.drizzle.fill", color: "#64D2FF" };
  if (code >= 61 && code <= 67) return { symbol: "cloud.rain.fill", color: "#0A84FF" };
  if (code >= 71 && code <= 77) return { symbol: "snowflake", color: "#5AC8FA" };
  if (code >= 80 && code <= 82) return { symbol: "cloud.heavyrain.fill", color: "#0A84FF" };
  if (code === 85 || code === 86) return { symbol: "cloud.snow.fill", color: "#5AC8FA" };
  if (code >= 95) return { symbol: "cloud.bolt.rain.fill", color: "#BF5AF2" };
  return { symbol: "questionmark.circle.fill", color: "#8E8E93" };
}

// 当前温度的颜色：越冷越蓝，越热越红
function tempColor(t) {
  if (typeof t !== "number") return "#FFFFFF";
  if (t <= 0) return "#64D2FF";
  if (t <= 10) return "#0A84FF";
  if (t <= 20) return "#30D158";
  if (t <= 30) return "#FF9F0A";
  return "#FF453A";
}

// ---------------- 天气代码转换 ----------------
function weatherText(code) {
  switch (code) {
    case 0: return "晴";
    case 1: return "晴间多云";
    case 2: return "多云";
    case 3: return "阴";
    case 45:
    case 48: return "雾";
    case 51:
    case 53:
    case 55: return "毛毛雨";
    case 56:
    case 57: return "冻毛毛雨";
    case 61:
    case 63:
    case 65: return "下雨";
    case 66:
    case 67: return "冻雨";
    case 71:
    case 73:
    case 75:
    case 77: return "下雪";
    case 80:
    case 81:
    case 82: return "阵雨";
    case 85:
    case 86: return "阵雪";
    case 95:
    case 96:
    case 99: return "雷雨";
    default: return "未知天气";
  }
}

// ---------------- 地名转经纬度 ----------------
// Nominatim 免费地理编码（OpenStreetMap 数据，支持中文地名，无需 key）
// 每个城市+县只解析一次，结果缓存在本地；改城市后重新解析一次
const GEOCODE_API = "https://nominatim.openstreetmap.org/search";

async function getCoords(ctx, city, area) {
  const query = String((city || "") + (area || "")).trim();
  if (!query) return null;
  const cacheKey = "weather.coords.v1." + query;
  const cached = ctx.storage?.getJSON(cacheKey);
  if (cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lon)) return cached;
  try {
    const url = GEOCODE_API + "?q=" + encodeURIComponent(query) + "&format=json&limit=5&addressdetails=1";
    const resp = await ctx.http.get(url, { headers: { "User-Agent": "Egern-Weather-Widget/1.0" }, timeout: 8000 });
    const results = await resp.json();
    if (!Array.isArray(results) || !results.length) return null;
    // 优先选地址里包含所填城市的那条，否则取第一条
    const picked = results.find(r => (r.display_name || "").includes(city)) || results[0];
    const lat = Number(picked.lat), lon = Number(picked.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const coords = { lat, lon };
    ctx.storage?.setJSON(cacheKey, coords);
    return coords;
  } catch (e) {
    console.log("地理编码失败：" + e);
    return null;
  }
}

// ---------------- 获取天气 ----------------
async function getWeather(ctx, lat, lon) {
  try {
    const url =
      WEATHER_API +
      "?latitude=" + lat +
      "&longitude=" + lon +
      "&current=temperature_2m,weather_code" +
      "&daily=temperature_2m_max,temperature_2m_min" +
      "&temperature_unit=celsius" +
      "&timezone=Asia%2FShanghai";

    const resp = await ctx.http.get(url);
    const data = await resp.json();

    if (!data.current || !data.daily) {
      throw new Error("天气数据为空");
    }

    return {
      temperature: Math.round(data.current.temperature_2m),
      max: Math.round(data.daily.temperature_2m_max[0]),
      min: Math.round(data.daily.temperature_2m_min[0]),
      weather: weatherText(data.current.weather_code),
      code: data.current.weather_code,
    };
  } catch (e) {
    console.log("天气获取失败：" + e);
    return { temperature: "--", max: "--", min: "--", weather: "获取失败", code: -1 };
  }
}

function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

// 背景样式（三档，Env：WIDGET_STYLE，默认纯黑背景）
function widgetBackground(ctx) {
  const style = String(ctx.env?.WIDGET_STYLE || "纯黑背景").trim();
  if (style === "毛玻璃透明") return {}; // 不设背景色，桌面壁纸直接透出
  if (style === "毛玻璃纯黑") return { backgroundColor: "rgba(0, 0, 0, 0.55)" };
  return { backgroundColor: "#000000" }; // 纯黑背景
}

// ---------------- 入口 ----------------
export default async function (ctx) {
  const env = ctx.env || {};
  const city = env.CITY || DEFAULT_CITY;
  const area = env.AREA || DEFAULT_AREA;

  const coords = await getCoords(ctx, city, area);
  const weather = coords
    ? await getWeather(ctx, coords.lat, coords.lon)
    : { temperature: "--", max: "--", min: "--", weather: "获取失败", code: -1 };
  const wStyle = weatherStyle(weather.code);
  const tColor = tempColor(weather.temperature);

  const now = new Date();
  const updateText = pad(now.getHours()) + ":" + pad(now.getMinutes()) + " 更新";

  // 30 分钟后刷新
  const refreshAfter = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  return {
    type: "widget",
    ...widgetBackground(ctx),
    padding: 14,
    refreshAfter: refreshAfter,
    children: [
      // 顶部地区
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          {
            type: "image",
            src: "sf-symbol:mappin.and.ellipse",
            color: COLOR_REGION_ICON,
            width: 14,
            height: 14,
          },
          {
            type: "text",
            text: city + "·" + area,
            font: { size: 16, weight: "bold" },
            textColor: "#FFFFFF",
            maxLines: 1,
            minScale: 0.7,
          },
        ],
      },

      { type: "spacer", length: 3 },

      // 天气状态：彩色图标 + 文字
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 4,
        children: [
          {
            type: "image",
            src: "sf-symbol:" + wStyle.symbol,
            color: wStyle.color,
            width: 12,
            height: 12,
          },
          {
            type: "text",
            text: weather.weather,
            font: { size: 11, weight: "medium" },
            textColor: wStyle.color,
            maxLines: 1,
          },
        ],
      },

      { type: "spacer", length: 7 },

      // 当前实时温度 + °
      {
        type: "stack",
        direction: "row",
        alignItems: "start",
        children: [
          { type: "spacer" },
          {
            type: "text",
            text: String(weather.temperature),
            font: { size: TEMP_FONT_SIZE, weight: "bold" },
            textColor: tColor,
            maxLines: 1,
          },
          {
            type: "text",
            text: "°",
            font: { size: DEGREE_FONT_SIZE },
            textColor: tColor,
          },
          { type: "spacer" },
        ],
      },

      { type: "spacer", length: 3 },

      // 最高 / 最低温度
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "spacer" },
          {
            type: "text",
            text: "↑ " + weather.max + "°",
            font: { size: RANGE_FONT_SIZE, weight: "medium" },
            textColor: COLOR_MAX,
            maxLines: 1,
            minScale: 0.7,
          },
          { type: "spacer", length: 10 },
          {
            type: "text",
            text: "↓ " + weather.min + "°",
            font: { size: RANGE_FONT_SIZE, weight: "medium" },
            textColor: COLOR_MIN,
            maxLines: 1,
            minScale: 0.7,
          },
          { type: "spacer" },
        ],
      },

      // 撑开，把更新时间顶到底部
      { type: "spacer" },

      {
        type: "text",
        text: updateText,
        font: { size: 8 },
        textColor: "#636366",
        maxLines: 1,
      },
    ],
  };
}
