// ============================================================
//  IP 检测 · Egern 小号方块组件
//  由 Scriptable 脚本转换而来，脚本类型：generic
//  功能：IP / 归属地 / 国旗 / VPN·代理状态 / 原生·家宽 / 风险评分
// ============================================================

const API_URL = "http://ip-api.com/json/?lang=zh-CN";

// 国内 IP 查询源（用于和国际源对比，判断是否分流代理）
const CHINA_IP_APIS = [
  "https://ip.3322.net",
  "https://api.ipify.org?format=json",
  "https://checkip.amazonaws.com",
];

const REFRESH_MINUTES = 1; // iOS 会酌情调整

const API_TIMEOUT = 8000;      // 毫秒
const CHINA_API_TIMEOUT = 2000; // 毫秒

const COLORS = {
  safe: "#30D158",      // 绿
  warning: "#FF9F0A",   // 橙
  danger: "#FF453A",    // 红
  secondary: "#8E8E93", // 灰
  border: "#636366",    // 分隔点
  label: "#FFFFFF",
  background: "#000000",

  // 强调色（和其他组件统一）
  blue: "#0A84FF",   // 顶部地球图标
  cyan: "#64D2FF",   // IP 地址
  purple: "#BF5AF2", // 运营商
  yellow: "#FFD60A", // 非家宽
};

// ★ 最上面一行：文字保持白色，地球图标改成蓝色
const STATUS_COLOR = "#FFFFFF";     // 代理状态文字
const STATUS_ICON_COLOR = "#0A84FF"; // 地球图标
// 字号 16、粗体，与「时间倒计时」组件的标题一致
const STATUS_FONT_SIZE = 16;

const RISK_KEYWORDS = {
  dataCenter: ["数据中心", "Amazon", "Google", "Tencent", "Alibaba", "Cloudflare", "IDC", "DMIT", "Vultr", "DigitalOcean", "Linode", "OVH"],
  homeBroadband: ["电信", "移动", "联通", "宽带", "Comcast", "Verizon", "ChinaNet", "家庭", "住宅"],
  highRiskCountries: ["俄罗斯", "印度", "乌克兰"],
  vpnKeywords: ["VPN", "Proxy", "Tunnel", "虚拟", "加速器", "节点"],
};

// ======================= 网络请求 =======================

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("timeout"));
      }, ms);
    }),
  ]);
}

async function fetchIPInfo(ctx) {
  try {
    const resp = await withTimeout(ctx.http.get(API_URL), API_TIMEOUT);
    const data = await resp.json();
    if (!data || (data.status && data.status !== "success")) return null;
    return data;
  } catch (e) {
    console.log("获取 IP 数据失败：" + e);
    return null;
  }
}

async function fetchChinaIP(ctx) {
  for (const url of CHINA_IP_APIS) {
    try {
      const resp = await withTimeout(ctx.http.get(url), CHINA_API_TIMEOUT);
      const text = await resp.text();
      let ip = null;
      try {
        const data = JSON.parse(text);
        ip = (data && (data.ip || data.query || data.origin)) || null;
      } catch (_) {
        const m = text.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
        if (m) ip = m[0];
      }
      if (ip && typeof ip === "string" && !isPrivateIP(ip)) {
        console.log("[IP检测] 国内IP: " + ip + " (" + url + ")");
        return ip;
      }
    } catch (_) {
      continue;
    }
  }
  console.log("[IP检测] 国内IP查询失败，将使用地理位置备用方案");
  return null;
}

// ======================= 检测逻辑 =======================

function isPrivateIP(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4) return false;
  if (p[0] === 10) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 127) return true;
  return false;
}

function analyzeISP(isp, org) {
  const combined = ((isp || "").toLowerCase() + " " + (org || "").toLowerCase());
  const has = function (list) {
    return list.some(function (kw) {
      return combined.includes(kw.toLowerCase());
    });
  };

  const isDataCenter = has(RISK_KEYWORDS.dataCenter);
  const isHomeBroadband = has(RISK_KEYWORDS.homeBroadband);
  const isVPNService = has(RISK_KEYWORDS.vpnKeywords);

  let confidence = 50;
  if (isDataCenter) confidence += 30;
  if (isVPNService) confidence += 20;
  if (isHomeBroadband) confidence -= 20;

  return {
    isDataCenter: isDataCenter,
    isHomeBroadband: isHomeBroadband,
    isVPNService: isVPNService,
    confidence: Math.max(0, Math.min(100, confidence)),
  };
}

function isOverseasIP(ipInfo) {
  if (ipInfo.countryCode && ipInfo.countryCode !== "CN") return true;
  if (ipInfo.country && !ipInfo.country.includes("中国")) return true;
  return false;
}

function detectVPNStatus(ipInfo, chinaIP) {
  const isp = analyzeISP(ipInfo.isp, ipInfo.org);
  const intlIP = ipInfo.query;

  let vpnScore = 0;
  let isProxy = false;
  let proxyType = "";

  // 1. 多源 IP 对比
  if (chinaIP && chinaIP !== intlIP) {
    isProxy = true;
    proxyType = "分流代理";
    vpnScore += 50;
  }

  // 2. 国内 IP 获取失败且当前 IP 在海外
  if (!chinaIP && isOverseasIP(ipInfo)) {
    isProxy = true;
    proxyType = "代理";
    vpnScore += 45;
  }

  // 3. ISP 分析
  if (isp.isVPNService) vpnScore += 35;
  else if (isp.isDataCenter) vpnScore += 25;

  // 4. 家宽特征降权
  if (isp.isHomeBroadband && !isp.isDataCenter) vpnScore -= 20;

  let confidence = isp.confidence;
  if (vpnScore > 0) confidence = Math.min(95, confidence + vpnScore);
  else confidence = Math.max(5, confidence);

  return { isVPN: vpnScore >= 60, isProxy: isProxy, proxyType: proxyType, confidence: confidence };
}

function calculateRiskValue(ipInfo, chinaIP) {
  let risk = 0;
  const vpn = detectVPNStatus(ipInfo, chinaIP);
  const isp = analyzeISP(ipInfo.isp, ipInfo.org);

  if (vpn.isVPN || vpn.isProxy) risk += vpn.confidence * 0.5;
  if (isp.isDataCenter) risk += 20;
  if (isp.isHomeBroadband) risk -= 15;
  if (RISK_KEYWORDS.highRiskCountries.some(function (kw) {
    return (ipInfo.country || "").includes(kw);
  })) risk += 25;

  risk = Math.max(0, Math.min(100, risk));

  let vpnStatus = "未连接";
  if (vpn.isVPN) vpnStatus = "已连接";
  else if (vpn.isProxy) vpnStatus = vpn.proxyType;

  return {
    riskValue: Math.round(risk),
    isHomeBroadband: isp.isHomeBroadband ? "家宽" : "非家宽",
    isNative: risk < 50 ? "原生" : "非原生",
    vpnStatus: vpnStatus,
  };
}

// ======================= 国旗（emoji，免联网） =======================

function flagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "📍";
  const code = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "📍";
  return String.fromCodePoint(
    0x1f1e6 + code.charCodeAt(0) - 65,
    0x1f1e6 + code.charCodeAt(1) - 65
  );
}

// ======================= UI 元素 =======================

function txt(text, size, weight, color, minScale) {
  return {
    type: "text",
    text: String(text),
    font: { size: size, weight: weight },
    textColor: color,
    maxLines: 1,
    minScale: minScale || 0.8,
  };
}

// 水平居中的一行
function centerRow(children, gap) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: gap || 0,
    children: [{ type: "spacer" }].concat(children, [{ type: "spacer" }]),
  };
}

// ======================= 背景样式（三档，Env：WIDGET_STYLE，默认纯黑背景） =======================

function widgetBackground(ctx) {
  const style = String(ctx.env?.WIDGET_STYLE || "纯黑背景").trim();
  if (style === "毛玻璃透明") return {}; // 不设背景色，桌面壁纸直接透出
  if (style === "毛玻璃纯黑") return { backgroundColor: "rgba(0, 0, 0, 0.55)" };
  return { backgroundColor: "#000000" }; // 纯黑背景
}

// ======================= 入口 =======================

export default async function (ctx) {
  const refreshAfter = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000).toISOString();

  // 并行获取：国际 IP 信息 + 国内 IP
  const results = await Promise.all([fetchIPInfo(ctx), fetchChinaIP(ctx)]);
  const ipInfo = results[0];
  const chinaIP = results[1];

  if (!ipInfo) {
    return {
      type: "widget",
      ...widgetBackground(ctx),
      padding: 12,
      refreshAfter: refreshAfter,
      children: [
        { type: "spacer" },
        centerRow([txt("无法获取 IP 数据", 14, "medium", COLORS.danger)]),
        { type: "spacer" },
      ],
    };
  }

  const risk = calculateRiskValue(ipInfo, chinaIP);
  const riskValue = risk.riskValue;
  const isHomeBroadband = risk.isHomeBroadband;
  const isNative = risk.isNative;
  const vpnStatus = risk.vpnStatus;

  // 台湾特殊映射
  let countryCode = ipInfo.countryCode;
  if ((ipInfo.country || "").includes("台湾") && countryCode === "CN") countryCode = "TW";

  const statusText =
    vpnStatus === "分流代理" || vpnStatus === "代理" ? vpnStatus : "VPN " + vpnStatus;
  const riskColor = riskValue > 60 ? COLORS.danger : riskValue > 20 ? COLORS.warning : COLORS.safe;
  const location = ((ipInfo.country || "未知") + " · " + (ipInfo.city || "")).trim();

  return {
    type: "widget",
    ...widgetBackground(ctx),
    padding: 12,
    refreshAfter: refreshAfter,
    children: [
      { type: "spacer" },

      // 1. 地球图标（蓝）+ VPN/代理状态（白）
      centerRow(
        [
          { type: "image", src: "sf-symbol:globe", color: STATUS_ICON_COLOR, width: 16, height: 16 },
          txt(statusText, STATUS_FONT_SIZE, "bold", STATUS_COLOR),
        ],
        6
      ),

      { type: "spacer", length: 10 },

      // 2. IP 地址
      centerRow([txt(ipInfo.query, 26, "bold", COLORS.cyan, 0.5)]),

      { type: "spacer", length: 10 },

      // 3. 国旗 + 归属地
      centerRow(
        [
          txt(flagEmoji(countryCode), 16, "regular", COLORS.label, 1),
          txt(location, 14, "semibold", COLORS.label),
        ],
        8
      ),

      { type: "spacer", length: 10 },

      // 4. 运营商 / 机房
      centerRow([txt(ipInfo.isp || "未知网络", 12, "medium", COLORS.purple)]),

      { type: "spacer", length: 10 },

      // 5. 状态汇总：原生 · 家宽 · 风险
      centerRow(
        [
          txt(isNative, 11, "bold", isNative === "原生" ? COLORS.safe : COLORS.warning),
          txt("·", 11, "regular", COLORS.border),
          txt(isHomeBroadband, 11, "bold", isHomeBroadband === "家宽" ? COLORS.safe : COLORS.yellow),
          txt("·", 11, "regular", COLORS.border),
          txt(riskValue + "%", 11, "bold", riskColor),
          txt("风险", 9, "regular", COLORS.secondary),
        ],
        4
      ),

      { type: "spacer" },
    ],
  };
}
