/**
 * Egern 小组件：机场订阅（多机场版，最多 5 个）
 *
 * 改自 IBL3ND Sub_Widget，匹配用户其他小组件格式。
 * 每个机场只填名称和订阅链接，到期日期从订阅自动获取。
 *
 * Env：
 * - NAME1-5：机场名称
 * - URL1-5：机场订阅链接
 * - REFRESH_HOURS：刷新间隔（小时），默认 2
 * - WIDGET_STYLE：纯黑背景 / 毛玻璃纯黑 / 毛玻璃透明，默认纯黑背景
 *
 * 显示数量：
 * - 小尺寸：2 条
 * - 中尺寸：3 条
 * - 大尺寸：5 条
 */

const BG_COLOR = '#000000';

const C = {
  bg: BG_COLOR,
  text: '#FFFFFF',
  dim: '#8E8E93',
  secondary: '#D1D1D6',
  panel: '#111114',
  hairline: '#242429',
  track: '#2C2C2E',
  accent: '#0A84FF',
  ok: '#30D158',
  warn: '#FF9F0A',
  fail: '#FF453A'
};

// 背景样式（三档，Env：WIDGET_STYLE，默认纯黑背景）
function styleMode(ctx) {
  const value = String(ctx.env?.WIDGET_STYLE || '纯黑背景').trim();
  if (value === '毛玻璃透明' || value === '毛玻璃纯黑') return value;
  return '纯黑背景';
}

function rootBackground(mode) {
  if (mode === '毛玻璃透明') return {};
  if (mode === '毛玻璃纯黑') return { backgroundColor: 'rgba(0, 0, 0, 0.55)' };
  return { backgroundColor: BG_COLOR };
}

function numberEnv(ctx, key, fallback, min, max) {
  const value = Number(ctx.env?.[key]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const CACHE_TIME = 1 * 60 * 60 * 1000;

const UA_LIST = [
  { "User-Agent": "Quantumult%20X/1.5.2" },
  { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" },
  { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" },
];

function buildVariants(url) {
  const seen = new Set();
  const out = [];
  const add = (u) => { if (u && !seen.has(u)) { seen.add(u); out.push(u); } };
  add(url);
  add(withParam(url, "flag", "clash"));
  add(withParam(url, "flag", "meta"));
  return out;
}

function withParam(url, key, value) {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function parseUserInfo(header) {
  if (!header) return null;
  const pairs = header.match(/\w+=[\d.eE+-]+/g) || [];
  if (!pairs.length) return null;
  return Object.fromEntries(pairs.map(p => {
    const [k, v] = p.split("=");
    return [k, Number(v)];
  }));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}${units[i]}`;
}

async function fetchInfo(ctx, slot) {
  const cacheKey = `sub_cache_${slot.url}`;
  let cache = await ctx.storage.get(cacheKey);
  let cacheData = null;

  if (cache) {
    try {
      const parsed = JSON.parse(cache);
      if (Date.now() - parsed.time < CACHE_TIME) {
        return { ...parsed.data, name: slot.name };
      }
      cacheData = parsed.data;
    } catch {}
  }

  const urls = buildVariants(slot.url);

  for (const method of ["head", "get"]) {
    for (const url of urls) {
      for (const headers of UA_LIST) {
        try {
          const resp = await ctx.http[method](url, { headers });
          const raw = resp.headers.get("subscription-userinfo") || "";
          const info = parseUserInfo(raw);

          if (info) {
            const used = (info.upload || 0) + (info.download || 0);
            const totalBytes = info.total || 0;
            const percent = totalBytes > 0 ? (used / totalBytes) * 100 : 0;

            const result = {
              error: null,
              used,
              totalBytes,
              percent,
              expire: info.expire || null,
            };

            await ctx.storage.set(cacheKey, JSON.stringify({
              time: Date.now(),
              data: result,
            }));

            return { ...result, name: slot.name };
          }
        } catch (_) {}
      }
    }
  }

  if (cacheData) {
    return { ...cacheData, name: slot.name };
  }

  return { name: slot.name, error: true };
}

function buildCard(result, ctx, isMediumThree) {
  const { name, error, used, totalBytes, percent, expire } = result;

  let statusColor = C.ok;
  if (error) statusColor = C.fail;
  else if (percent >= 95) statusColor = C.fail;
  else if (percent >= 80) statusColor = C.warn;
  else if (percent >= 50) statusColor = C.accent;

  const innerGap = isMediumThree ? 2 : 5;
  const barHeight = isMediumThree ? 3 : 5;

  if (error) {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 6,
      padding: [4, 0],
      children: [
        { type: "image", src: "sf-symbol:exclamationmark.circle.fill", width: 12, height: 12, color: C.fail },
        { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: C.text, flex: 1 },
        { type: "text", text: "失败", font: { size: "caption2", weight: "semibold" }, textColor: C.fail },
      ],
    };
  }

  const progressPercent = Math.min(Math.max(percent, 0), 100);
  const usedStr = formatBytes(used);
  const totalStr = formatBytes(totalBytes);
  const remainStr = formatBytes(totalBytes - used);

  let expireText = "永久有效";
  if (expire && Number(expire) > 0) {
    let ts = Number(expire);
    if (ts < 1e12) ts *= 1000;
    const d = new Date(ts);
    expireText = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return {
    type: "stack",
    direction: "column",
    gap: innerGap,
    padding: [4, 0],
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          { type: "image", src: "sf-symbol:circle.fill", width: 6, height: 6, color: statusColor },
          { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: C.text, flex: 1 },
          { type: "text", text: `${Math.round(progressPercent)}%`, font: { size: "caption2", weight: "bold" }, textColor: statusColor },
        ],
      },
      {
        type: "stack",
        direction: "row",
        height: barHeight,
        borderRadius: 3,
        children: [
          { type: "stack", flex: Math.max(progressPercent, 1), height: barHeight, backgroundColor: statusColor, borderRadius: 3 },
          { type: "stack", flex: Math.max(100 - progressPercent, 1), height: barHeight, backgroundColor: C.track, borderRadius: 3 },
        ],
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          { type: "text", text: `${usedStr}/${totalStr}`, font: { size: "caption2", weight: "medium" }, textColor: C.secondary },
          { type: "spacer" },
          ...(ctx.widgetFamily === "systemSmall" ? [] : [
            { type: "text", text: expireText, font: { size: "caption2", weight: "medium" }, textColor: C.dim },
            { type: "spacer" },
          ]),
          { type: "text", text: `剩${remainStr}`, font: { size: "caption2", weight: "semibold" }, textColor: C.ok },
        ],
      },
    ],
  };
}

export default async function (ctx) {
  const mode = styleMode(ctx);
  const refreshHours = numberEnv(ctx, 'REFRESH_HOURS', 2, 0.5, 24);
  const refreshTime = new Date(Date.now() + refreshHours * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const MAX = 5;
  const slots = [];

  for (let i = 1; i <= MAX; i++) {
    const url = (ctx.env[`URL${i}`] || "").trim();
    if (!url) continue;

    slots.push({
      name: (ctx.env[`NAME${i}`] || "").trim() || "机场订阅",
      url,
    });
  }

  if (!slots.length) {
    return {
      type: "widget",
      ...rootBackground(mode),
      padding: 16,
      gap: 12,
      refreshAfter: refreshTime,
      children: [
        {
          type: "stack",
          direction: "column",
          gap: 10,
          alignItems: "center",
          children: [
            { type: "image", src: "sf-symbol:wifi.slash", width: 32, height: 32, color: C.fail },
            { type: "text", text: "未配置订阅", font: { size: "headline", weight: "semibold" }, textColor: C.text },
          ],
        },
      ],
    };
  }

  const results = await Promise.all(slots.map((s) => fetchInfo(ctx, s)));

  const widgetFamily = ctx.widgetFamily;
  const isLarge = widgetFamily === "systemLarge";
  const isMedium = widgetFamily === "systemMedium";

  const maxDisplay = isLarge ? 5 : (isMedium ? 3 : 2);
  const numSubs = Math.min(slots.length, maxDisplay);
  const isCompact = numSubs >= 2;
  const isMediumThree = isMedium && numSubs === 3;

  return {
    type: "widget",
    ...rootBackground(mode),
    padding: isMediumThree ? 6 : (isCompact ? 8 : 12),
    gap: isMediumThree ? 4 : (isCompact ? 5 : 8),
    refreshAfter: refreshTime,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          { type: "image", src: "sf-symbol:network", width: 12, height: 12, color: C.accent },
          { type: "text", text: "机场订阅", font: { size: "subheadline", weight: "bold" }, textColor: C.text },
          { type: "spacer" },
          { type: "image", src: "sf-symbol:arrow.clockwise", width: 12, height: 12, color: C.dim },
          { type: "text", text: timeStr, font: { size: "caption2", weight: "medium" }, textColor: C.dim },
        ],
      },
      {
        type: "stack",
        direction: "column",
        gap: isMediumThree ? 8 : 12,
        children: results.slice(0, maxDisplay).map((r) => buildCard(r, ctx, isMediumThree)),
      },
    ],
  };
}
