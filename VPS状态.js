// ============================================================
//  VPS 状态 · Egern 小组件
//  显示 qt-1 服务器 CPU、内存、硬盘、运行时间
//  数据来自 qt-register 服务的 /api/stats 接口
// ============================================================

const API_URL = "https://qingtianzhuce.ccwu.cc/api/stats";

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
  // 用 flex 按比例分：已用部分 flex=percent，未用部分 flex=100-percent
  const used = Math.max(percent, 2);
  const rest = 100 - used;
  return {
    type: "stack",
    direction: "row",
    height: 5,
    backgroundColor: COLORS.track,
    borderRadius: 2.5,
    children: [
      {
        type: "stack",
        flex: used,
        backgroundColor: color,
        borderRadius: 2.5,
        children: [],
      },
      {
        type: "stack",
        flex: rest,
        children: [],
      },
    ],
  };
}

function statRow(icon, name, value, percent) {
  const color = getColor(percent);
  return {
    type: "stack",
    direction: "column",
    gap: 4,
    children: [
      {
        type: "stack",
        direction: "row",
        children: [
          { type: "image", src: "sf-symbol:" + icon, color: COLORS.blue, width: 14, height: 14 },
          { type: "text", text: " " + name, font: { size: 13 }, textColor: COLORS.secondary },
          { type: "spacer" },
          { type: "text", text: value, font: { size: 13, weight: "semibold" }, textColor: COLORS.label },
        ],
      },
      progressBar(percent, color),
    ],
  };
}

// ======================= 背景样式（三档，Env：WIDGET_STYLE，默认纯黑背景） =======================

function widgetBackground(ctx) {
  const style = String(ctx.env?.WIDGET_STYLE || "纯黑背景").trim();
  if (style === "毛玻璃透明") return {}; // 不设背景色，桌面壁纸直接透出
  if (style === "毛玻璃纯黑") return { backgroundColor: "rgba(0, 0, 0, 0.55)" };
  return { backgroundColor: "#000000" }; // 纯黑背景
}

export default async function(ctx) {
  let data = null;
  try {
    const resp = await ctx.http.get(API_URL, { timeout: 10000 });
    data = await resp.json();
  } catch (e) {
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
          children: [
            { type: "image", src: "sf-symbol:server.rack", color: COLORS.red, width: 16, height: 16 },
            { type: "text", text: " qt-1", font: { size: 16, weight: "bold" }, textColor: COLORS.label },
            { type: "spacer" },
            { type: "text", text: "离线", font: { size: 13 }, textColor: COLORS.red },
          ],
        },
        { type: "spacer" },
        { type: "text", text: "无法连接服务器", font: { size: 13 }, textColor: COLORS.weak, textAlign: "center" },
        { type: "spacer" },
      ],
    };
  }

  const memUsed = formatBytes(data.mem.used);
  const memTotal = formatBytes(data.mem.total);
  const diskUsed = formatBytes(data.disk.used);
  const diskTotal = formatBytes(data.disk.total);
  const uptime = formatUptime(data.uptime);

  const family = ctx.widgetFamily;
  const isSmall = family === "systemSmall";

  if (isSmall) {
    // 小号：只显示 CPU 和内存，数值简短防溢出
    return {
      type: "widget",
      ...widgetBackground(ctx),
      padding: 16,
      refreshAfter: new Date(Date.now() + REFRESH_MINUTES * 60000).toISOString(),
      children: [
        {
          type: "stack",
          direction: "row",
          children: [
            { type: "image", src: "sf-symbol:server.rack", color: COLORS.blue, width: 16, height: 16 },
            { type: "text", text: " qt-1", font: { size: 16, weight: "bold" }, textColor: COLORS.label },
            { type: "spacer" },
            { type: "text", text: "● " + (data.online || 0) + "人", font: { size: 13 }, textColor: COLORS.green },
          ],
        },
        { type: "spacer", length: 12 },
        statRow("cpu", "CPU", data.cpu + "%", data.cpu),
        { type: "spacer", length: 10 },
        statRow("memorychip", "内存", data.mem.percent + "%", data.mem.percent),
        { type: "spacer" },
        { type: "text", text: "运行 " + uptime, font: { size: 11 }, textColor: COLORS.weak },
      ],
    };
  }

  // 中号和大号：显示全部
  return {
    type: "widget",
    ...widgetBackground(ctx),
    padding: 16,
    refreshAfter: new Date(Date.now() + REFRESH_MINUTES * 60000).toISOString(),
    children: [
      {
        type: "stack",
        direction: "row",
        children: [
          { type: "image", src: "sf-symbol:server.rack", color: COLORS.blue, width: 16, height: 16 },
          { type: "text", text: " qt-1 · 斯德哥尔摩", font: { size: 16, weight: "bold" }, textColor: COLORS.label },
          { type: "spacer" },
          { type: "text", text: "● " + (data.online || 0) + "人在线", font: { size: 13 }, textColor: COLORS.green },
        ],
      },
      { type: "spacer", length: 14 },
      statRow("cpu", "CPU", data.cpu + "% · " + data.cpuCount + "核 · 负载 " + data.load1, data.cpu),
      { type: "spacer", length: 12 },
      statRow("memorychip", "内存", memUsed + " / " + memTotal, data.mem.percent),
      { type: "spacer", length: 12 },
      statRow("internaldrive", "硬盘", diskUsed + " / " + diskTotal, data.disk.percent),
      { type: "spacer" },
      {
        type: "stack",
        direction: "row",
        children: [
          { type: "text", text: "运行 " + uptime, font: { size: 11 }, textColor: COLORS.weak },
          { type: "spacer" },
          { type: "text", text: "5分钟前更新", font: { size: 11 }, textColor: COLORS.weak },
        ],
      },
    ],
  };
}
