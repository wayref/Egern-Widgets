// ============================================================
//  时间倒计时 · Egern 小号方块组件（模块版）
//  由 Scriptable 脚本转换而来，脚本类型：generic
// ============================================================

// ---------------- 自定义设置 ----------------
// 在模块 Env 里设置 AGE（必填）；LIFE_EXPECTANCY 可覆盖，默认 80
const DEFAULT_LIFE_EXPECTANCY = 80;

// ---------------- 字号设置 ----------------
const TITLE_SIZE = 16;
const LABEL_SIZE = 13;
const PERCENT_SIZE = 12;
const AGE_SIZE = 13;

// ---------------- 布局设置 ----------------
// 进度条现在会自动占满「百分比」右边的全部剩余宽度，不再需要固定宽度。
// 想让进度条更长：把 LABEL_WIDTH / PERCENT_WIDTH / 两个 GAP 调小；
// 想让进度条更短：调大它们。
const BAR_HEIGHT = 5;
const LABEL_WIDTH = 28;        // 名称列宽（两个汉字 13 号字约 26）
const PERCENT_WIDTH = 38;      // 百分比列宽（"100.0%" 会自动缩小一点）
const LABEL_PERCENT_GAP = 3;   // 名称 → 百分比
const PERCENT_BAR_GAP = 6;     // 百分比 → 进度条（想让进度条再往左靠，就调小这个）
const ROW_GAP = 5;

// ---------------- 颜色 ----------------
const BACKGROUND_COLOR = "#000000";
const TEXT_COLOR = "#FFFFFF";
const AGE_COLOR = "#8E8E93";
const BAR_REMAINING_COLOR = "#2C2C2E";
const TITLE_ICON_COLOR = "#FFD60A";

// 每一行自己的颜色（进度条和百分比同色）
const COLOR_TODAY = "#FFD60A"; // 今日：黄
const COLOR_WEEK = "#30D158";  // 本周：绿
const COLOR_MONTH = "#64D2FF"; // 本月：青
const COLOR_YEAR = "#FF9F0A";  // 本年：橙
const COLOR_LIFE = "#BF5AF2";  // 人生：紫

// ============================================================
// 计算
// ============================================================

function clamp(v) {
  return Math.max(0, Math.min(100, v));
}

function passedPercent(now, start, end) {
  return clamp(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
}

function getToday(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return passedPercent(now, start, end);
}

// 周一开始，周日结束
function getWeek(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return passedPercent(now, start, end);
}

function getMonth(now) {
  return passedPercent(
    now,
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1)
  );
}

function getYear(now) {
  return passedPercent(
    now,
    new Date(now.getFullYear(), 0, 1),
    new Date(now.getFullYear() + 1, 0, 1)
  );
}

function getLife(age, expectancy) {
  if (expectancy <= 0) return 0;
  return clamp((age / expectancy) * 100);
}

function formatPercent(v) {
  return v.toFixed(1) + "%";
}

// ============================================================
// 进度条（自动占满剩余宽度，已过部分按比例着色）
// ============================================================

function progressBar(percent, color) {
  const passed = Math.max(0.001, percent);
  const remaining = Math.max(0.001, 100 - percent);
  const radius = BAR_HEIGHT / 2;

  return {
    type: "stack",
    direction: "row",
    height: BAR_HEIGHT,
    flex: 1,
    backgroundColor: BAR_REMAINING_COLOR,
    borderRadius: radius,
    children: [
      {
        type: "stack",
        height: BAR_HEIGHT,
        flex: passed,
        backgroundColor: color,
        borderRadius: radius,
        children: [],
      },
      { type: "spacer", flex: remaining },
    ],
  };
}

// ============================================================
// 一行
// ============================================================

function row(label, percent, color) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    children: [
      // 名称列，左对齐，固定宽度
      {
        type: "stack",
        direction: "row",
        width: LABEL_WIDTH,
        children: [
          {
            type: "text",
            text: label,
            font: { size: LABEL_SIZE, weight: "medium" },
            textColor: TEXT_COLOR,
            maxLines: 1,
          },
          { type: "spacer" },
        ],
      },
      { type: "spacer", length: LABEL_PERCENT_GAP },
      // 百分比列，右对齐，固定宽度
      {
        type: "stack",
        direction: "row",
        width: PERCENT_WIDTH,
        children: [
          { type: "spacer" },
          {
            type: "text",
            text: formatPercent(percent),
            font: { size: PERCENT_SIZE, weight: "medium" },
            textColor: color,
            maxLines: 1,
            minScale: 0.8,
          },
        ],
      },
      { type: "spacer", length: PERCENT_BAR_GAP },
      // 进度条占满剩余宽度
      progressBar(percent, color),
    ],
  };
}

// ============================================================
// 入口
// ============================================================

// 背景样式（三档，Env：WIDGET_STYLE，默认纯黑背景）
function widgetBackground(ctx) {
  const style = String(ctx.env?.WIDGET_STYLE || "纯黑背景").trim();
  if (style === "毛玻璃透明") return {}; // 不设背景色，桌面壁纸直接透出
  if (style === "毛玻璃纯黑") return { backgroundColor: "rgba(0, 0, 0, 0.55)" };
  return { backgroundColor: "#000000" }; // 纯黑背景
}

export default async function (ctx) {
  const env = ctx.env || {};
  const age = Number(env.AGE) || 0;
  const expectancy = Number(env.LIFE_EXPECTANCY) || DEFAULT_LIFE_EXPECTANCY;

  const now = new Date();

  return {
    type: "widget",
    ...widgetBackground(ctx),
    padding: [12, 12, 10, 12],
    refreshAfter: new Date(now.getTime() + 60 * 1000).toISOString(),
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          { type: "spacer" },
          {
            type: "image",
            src: "sf-symbol:hourglass",
            color: TITLE_ICON_COLOR,
            width: 15,
            height: 15,
          },
          {
            type: "text",
            text: "时间倒计时",
            font: { size: TITLE_SIZE, weight: "bold" },
            textColor: TEXT_COLOR,
            maxLines: 1,
          },
          { type: "spacer" },
        ],
      },
      { type: "spacer", length: 7 },

      row("今日", getToday(now), COLOR_TODAY),
      { type: "spacer", length: ROW_GAP },
      row("本周", getWeek(now), COLOR_WEEK),
      { type: "spacer", length: ROW_GAP },
      row("本月", getMonth(now), COLOR_MONTH),
      { type: "spacer", length: ROW_GAP },
      row("本年", getYear(now), COLOR_YEAR),
      { type: "spacer", length: ROW_GAP },
      row("人生", getLife(age, expectancy), COLOR_LIFE),

      { type: "spacer", length: 2 },
      {
        type: "stack",
        direction: "row",
        children: [
          { type: "spacer" },
          {
            type: "text",
            text: age > 0 ? age + " 岁 / " + expectancy + " 岁" : "未填年龄",
            font: { size: AGE_SIZE },
            textColor: AGE_COLOR,
            maxLines: 1,
          },
          { type: "spacer" },
        ],
      },
    ],
  };
}
