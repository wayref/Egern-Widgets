// ============================================================
//  VPS 状态 · Egern 小组件
//  通过 HTTP 接口获取 qt-1 服务器状态，显示 CPU、内存、硬盘、运行时间、在线人数
//  Env: API_URL, WIDGET_STYLE
// ============================================================

const REFRESH_MINUTES = 5;

const COLORS = {
  background: "#000000",
  label: "#FFFFFF",
  secondary: "#D1D1D6",
  weak: "#8E8E93",
  blue: "#0A84FF",
  green: "#30D158",
  orange: "#FF9F0A",
  red: "#FF453A",
  track: "#2C2C2E",
};

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + " GB";
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return days + "天" + hours + "小时";
  if (hours > 0) return hours + "小时" + minutes + "分";
  return minutes + "分钟";
}

function getColor(percent) {
  if (percent >= 90) return COLORS.red;
  if (percent >= 70) return COLORS.orange;
  return COLORS.green;
}

function progressBar(percent, color) {
  const used = Math.max(percent, 2);
  const rest = 100 - used;
  return {
    type: "stack",
    direction: "row",
    height: 5,
    backgroundColor: COLORS.track,
    cornerRadius: 2.5,
    children: [
      { type: "spacer", flex: used, backgroundColor: color, cornerRadius: 2.5 },
      { type: "spacer", flex: rest },
    ],
  };
}

function widgetBackground(ctx) {
  const style = ctx.env?.WIDGET_STYLE || "纯黑背景";
  if (style === "毛玻璃透明") {
    return { backgroundColor: "transparent" };
  }
  if (style === "毛玻璃纯黑") {
    return { backgroundColor: "#000000", opacity: 0.7 };
  }
  return { backgroundColor: COLORS.background };
}

async function fetchStats(ctx) {
  const apiUrl = ctx.env?.API_URL || "https://qingtianzhuce.ccwu.cc/api/stats";
  
  const response = await ctx.http.get(apiUrl, { timeout: 10000 });
  if (response.status !== 200) {
    throw new Error("接口返回 " + response.status);
  }
  
  const data = await response.json();
  return data;
}

export default async function(ctx) {
  let data = null;
  let errorMsg = "";
  try {
    data = await fetchStats(ctx);
  } catch (e) {
    errorMsg = e.message || "连接失败";
    // 请求失败，显示离线状态
    return {
      type: "widget",
      ...widgetBackground(ctx),
      padding: 16,
      refreshAfter: new Date(Date.now() + REFRESH_MINUTES * 60000).toISOString(),
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            { type: "text", text: "VPS 状态", font: { size: 16, weight: "semibold" }, textColor: COLORS.label },
            { type: "spacer" },
            { type: "text", text: "离线", font: { size: 13 }, textColor: COLORS.red },
          ],
        },
        { type: "spacer" },
        { type: "text", text: errorMsg, font: { size: 12 }, textColor: COLORS.weak, textAlign: "center" },
        { type: "spacer" },
      ],
    };
  }

  const cpuPercent = data.cpu;
  const memPercent = data.mem.percent;
  const diskPercent = data.disk.percent;
  const onlineCount = data.online || 0;

  const family = ctx.family || "systemSmall";

  if (family === "systemSmall") {
    return {
      type: "widget",
      ...widgetBackground(ctx),
      padding: 16,
      refreshAfter: new Date(Date.now() + REFRESH_MINUTES * 60000).toISOString(),
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            { type: "text", text: "VPS 状态", font: { size: 16, weight: "semibold" }, textColor: COLORS.label },
            { type: "spacer" },
            { type: "text", text: "● " + onlineCount + "人", font: { size: 13 }, textColor: COLORS.green },
          ],
        },
        { type: "spacer", flex: 1 },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            { type: "image", src: "sf-symbol:cpu", color: "#0A84FF", width: 13, height: 13 },
            { type: "text", text: " CPU", font: { size: 13 }, textColor: COLORS.secondary },
            { type: "spacer" },
            { type: "text", text: cpuPercent + "%", font: { size: 13, weight: "medium" }, textColor: getColor(cpuPercent) },
          ],
        },
        progressBar(cpuPercent, getColor(cpuPercent)),
        { type: "spacer", flex: 1 },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            { type: "image", src: "sf-symbol:memorychip", color: "#BF5AF2", width: 13, height: 13 },
            { type: "text", text: " 内存", font: { size: 13 }, textColor: COLORS.secondary },
            { type: "spacer" },
            { type: "text", text: memPercent + "%", font: { size: 13, weight: "medium" }, textColor: getColor(memPercent) },
          ],
        },
        progressBar(memPercent, getColor(memPercent)),
        { type: "spacer", flex: 1 },
        {
          type: "text",
          text: "运行 " + formatUptime(data.uptime),
          font: { size: 12 },
          textColor: COLORS.weak,
          textAlign: "center",
        },
      ],
    };
  }

  // 中号和大号
  return {
    type: "widget",
    ...widgetBackground(ctx),
    padding: 16,
    refreshAfter: new Date(Date.now() + REFRESH_MINUTES * 60000).toISOString(),
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "image", src: "sf-symbol:externaldrive", color: "#0A84FF", width: 16, height: 16 },
          { type: "text", text: " VPS 状态", font: { size: 16, weight: "semibold" }, textColor: COLORS.label },
          { type: "spacer" },
          { type: "text", text: "● " + onlineCount + "人在线", font: { size: 13 }, textColor: COLORS.green },
        ],
      },
      { type: "spacer", flex: 1 },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "image", src: "sf-symbol:cpu", color: "#0A84FF", width: 13, height: 13 },
          { type: "text", text: " CPU", font: { size: 13 }, textColor: COLORS.secondary },
          { type: "spacer" },
          { type: "text", text: cpuPercent + "% · " + data.cpuCount + "核 · 负载 " + data.load1, font: { size: 13, weight: "medium" }, textColor: getColor(cpuPercent) },
        ],
      },
      progressBar(cpuPercent, getColor(cpuPercent)),
      { type: "spacer", flex: 1 },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "image", src: "sf-symbol:memorychip", color: "#BF5AF2", width: 13, height: 13 },
          { type: "text", text: " 内存", font: { size: 13 }, textColor: COLORS.secondary },
          { type: "spacer" },
          { type: "text", text: formatBytes(data.mem.used) + " / " + formatBytes(data.mem.total), font: { size: 13, weight: "medium" }, textColor: getColor(memPercent) },
        ],
      },
      progressBar(memPercent, getColor(memPercent)),
      { type: "spacer", flex: 1 },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "image", src: "sf-symbol:internaldrive", color: "#FF9F0A", width: 13, height: 13 },
          { type: "text", text: " 硬盘", font: { size: 13 }, textColor: COLORS.secondary },
          { type: "spacer" },
          { type: "text", text: formatBytes(data.disk.used) + " / " + formatBytes(data.disk.total), font: { size: 13, weight: "medium" }, textColor: getColor(diskPercent) },
        ],
      },
      progressBar(diskPercent, getColor(diskPercent)),
      { type: "spacer", flex: 1 },
      {
        type: "text",
        text: "运行 " + formatUptime(data.uptime),
        font: { size: 12 },
        textColor: COLORS.weak,
        textAlign: "center",
      },
    ],
  };
}
