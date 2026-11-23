// ============================================================
//  VPS 状态 · Egern 小组件
//  通过 SSH 直连 qt-1 服务器，显示 CPU、内存、硬盘、运行时间、在线人数
//  Env: SSH_HOST, SSH_PORT, SSH_USER, SSH_PASS, WIDGET_STYLE
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

async function fetchStats(ctx) {
  const host = ctx.env?.SSH_HOST || "";
  const port = parseInt(ctx.env?.SSH_PORT || "22", 10);
  const username = ctx.env?.SSH_USER || "";
  const password = ctx.env?.SSH_PASS || "";

  if (!host || !username || !password) {
    throw new Error("请填写 SSH 地址、用户名和密码");
  }

  const session = await ctx.ssh.connect({ host, port, username, password, timeout: 10000 });

  try {
    // 一次执行多个命令，用 JSON 输出方便解析
    const cmd = `node -e "
const os = require('os');
const { execSync } = require('child_process');
const cpus = os.cpus();
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedMem = totalMem - freeMem;
const uptime = os.uptime();
const load1 = os.loadavg()[0];
const cpuCount = cpus.length;
const cpuPercent = Math.min(100, Math.round((load1 / cpuCount) * 100));
let disk = { total: 0, used: 0, percent: 0 };
try {
  const out = execSync('df -B1 / | tail -1', { timeout: 5000 }).toString().trim().split(/\\s+/);
  const total = parseInt(out[1], 10);
  const used = parseInt(out[2], 10);
  if (total > 0) disk = { total, used, percent: Math.round((used / total) * 100) };
} catch (_) {}
let online = 0;
try {
  const out = execSync(\"ss -tn state established '( dport = :25449 )' 2>/dev/null | tail -n +2 | awk '{print \\$5}' | cut -d: -f1 | sort -u\", { timeout: 5000 }).toString().trim();
  if (out) online = out.split('\\n').filter(ip => ip && ip !== '127.0.0.1').length;
} catch (_) {}
console.log(JSON.stringify({ cpu: cpuPercent, cpuCount, load1: Math.round(load1 * 100) / 100, mem: { total: totalMem, used: usedMem, percent: Math.round((usedMem / totalMem) * 100) }, disk, uptime: Math.floor(uptime), online }));
"`;

    const result = await session.exec(cmd);
    if (result.code !== 0) {
      throw new Error("命令执行失败: " + result.stderr);
    }
    return JSON.parse(result.stdout);
  } finally {
    // SSH 会话会自动关闭
  }
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
          children: [
            { type: "image", src: "sf-symbol:server.rack", color: COLORS.red, width: 16, height: 16 },
            { type: "text", text: " qt-1", font: { size: 16, weight: "bold" }, textColor: COLORS.label },
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
