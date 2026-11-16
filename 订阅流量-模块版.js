/**
* Egern 小组件：订阅流量
*
* 使用方法：新建一个 Generic 脚本，粘贴本文件，
* 然后直接修改下面「★ 在这里填写 ★」那一块的引号内容即可，不用再设置环境变量。
* （如果你更习惯用 Egern 的环境变量 env，也可以，env 里的值优先。）
*
* 修改记录：背景三档可选（纯黑背景/毛玻璃纯黑/毛玻璃透明，默认纯黑背景），所有颜色固定为深色模式配色；
* 标题改为订阅名称（16 号粗体白色，和其他组件第一行一致）；
* 进度条、仪表盘、标题图标改为蓝色；其余数据按含义上色。
*/

// ============================================================
// ★★★★★★★★★★★★★★ 在这里填写 ★★★★★★★★★★★★★★
// ============================================================

// 订阅链接：把引号里的中文删掉，换成你自己的订阅链接
// 例：const MY_SUBSCRIPTION_URL = "https://example.com/subscribe?token=xxxx";
const MY_SUBSCRIPTION_URL = ""; // 订阅链接填模块 Env（SUBSCRIPTION_URL）

// 订阅名称：显示在组件上，比如「我的机场」
const MY_SUBSCRIPTION_NAME = "";

// 套餐总流量，单位 GB（只有订阅只返回「剩余流量」时才用来估算总量）
const MY_PLAN_TOTAL_GB = 100;

// ============================================================
// ★★★★★★★★★★★★★★ 填写结束 ★★★★★★★★★★★★★★
// ============================================================

// 没改动的占位文字视为「没填」
const PLACEHOLDER = '在这里填写';
const userValue = value => {
const v = String(value || '').trim();
return v &&!v.startsWith(PLACEHOLDER)? v: '';
};

const BG_COLOR = '#000000';

const C = {
bg: BG_COLOR,
text: '#FFFFFF',
dim: '#8E8E93',
panel: '#111114',
hairline: '#242429',
track: '#2C2C2E',
accent: '#0A84FF', // 蓝：标题图标、进度条、仪表盘、百分比
ok: '#30D158', // 绿：流量充足
warn: '#FF9F0A', // 橙：流量偏低
fail: '#FF453A' // 红：已用完 / 失败
};

// 大号里各项数据的颜色
const COLOR_DOWNLOAD = '#64D2FF'; // 下载：青
const COLOR_UPLOAD = '#FF9F0A'; // 上传：橙
const COLOR_USED = '#BF5AF2'; // 合计已用：紫
const COLOR_DAYS = '#FFD60A'; // 剩余天数：黄
const COLOR_DAILY = '#30D158'; // 日均可用：绿


const GAUGE_API = 'https://quickchart.io/chart';

function numberEnv(ctx, key, fallback, min, max) {
const value = Number(ctx.env?.[key]);
if (!Number.isFinite(value)) return fallback;
return Math.min(max, Math.max(min, value));
}

// 背景样式（三档，Env：WIDGET_STYLE，默认纯黑背景）
function styleMode(ctx) {
const value = String(ctx.env?.WIDGET_STYLE || '纯黑背景').trim();
if (value === '毛玻璃透明' || value === '毛玻璃纯黑') return value;
return '纯黑背景';
}

// 毛玻璃透明：不设背景色，桌面壁纸直接透出；毛玻璃纯黑：半透明黑底；纯黑背景：不透明黑底
function rootBackground(mode) {
if (mode === '毛玻璃透明') return {};
if (mode === '毛玻璃纯黑') return { backgroundColor: 'rgba(0, 0, 0, 0.55)'};
return { backgroundColor: BG_COLOR};
}

function hashString(value) {
let hash = 5381;
for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
return (hash >>> 0).toString(36);
}

function storageKey(url) {
return `egern.subscription.traffic.v1.${hashString(url)}`;
}

function readHeader(headers, name) {
if (!headers) return '';
if (typeof headers.get === 'function') return headers.get(name) || '';
const target = String(name).toLowerCase();
const matchedKey = Object.keys(headers).find(key => key.toLowerCase() === target);
return matchedKey? headers[matchedKey]: '';
}

function parseUserInfo(raw) {
const values = {};
String(raw || '').split(';').forEach(part => {
const index = part.indexOf('=');
if (index < 1) return;
const key = part.slice(0, index).trim().toLowerCase();
const value = Number(part.slice(index + 1).trim());
if (Number.isFinite(value)) values[key] = value;
});

if (!Number.isFinite(values.upload) ||!Number.isFinite(values.download) ||!Number.isFinite(values.total)) {
return null;
}

const upload = Math.max(0, values.upload);
const download = Math.max(0, values.download);
const total = Math.max(0, values.total);
const used = upload + download;
const unlimited = total === 0;
const remaining = unlimited? Infinity: Math.max(0, total - used);
const expireValue = Number(values.expire) || 0;
const expireAt = expireValue > 1000000000000? expireValue: expireValue * 1000;

return { upload, download, total, used, remaining, unlimited, expireAt};
}

function unitBytes(value, unit) {
const powers = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4, PB: 5};
const power = powers[String(unit || '').toUpperCase()];
if (power == null) return null;
return Number(value) * (1024 ** power);
}

function parseBodyInfo(body) {
const source = String(body || '').replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
const expireMatch = source.match(/(?:有效期|到期(?:时间)?|过期(?:时间)?)[：:\s]*([12]\d{3}[-/.]\d{1,2}[-/.]\d{1,2})/i);
const remainingMatch = source.match(/剩余(?:流量)?[：:\s]*([0-9]+(?:\.[0-9]+)?)\s*(PB|TB|GB|MB|KB|B)/i);
if (!remainingMatch) return null;

const remaining = unitBytes(remainingMatch[1], remainingMatch[2]);
if (!Number.isFinite(remaining)) return null;

const totalMatch = source.match(/(?:总(?:流量|量)|套餐流量)[：:\s]*([0-9]+(?:\.[0-9]+)?)\s*(PB|TB|GB|MB|KB|B)/i);
const usedMatch = source.match(/已用(?:流量)?[：:\s]*([0-9]+(?:\.[0-9]+)?)\s*(PB|TB|GB|MB|KB|B)/i);
const total = totalMatch? unitBytes(totalMatch[1], totalMatch[2]): null;
const explicitUsed = usedMatch? unitBytes(usedMatch[1], usedMatch[2]): null;
const used = Number.isFinite(explicitUsed)
? explicitUsed
: Number.isFinite(total)
? Math.max(0, total - remaining)
: null;

let expireAt = 0;
if (expireMatch) {
const normalized = expireMatch[1].replace(/[/.]/g, '-');
const parsed = new Date(`${normalized}T23:59:59`);
if (!Number.isNaN(parsed.getTime())) expireAt = parsed.getTime();
}

return {
upload: null,
download: null,
total,
used,
remaining,
unlimited: false,
expireAt,
partial:!Number.isFinite(total),
source: 'body'
};
}

function applyPlanTotal(ctx, traffic) {
const configured = String(ctx.env?.PLAN_TOTAL_GB || '').trim();
const planGB = configured? Number(configured): Number(MY_PLAN_TOTAL_GB) || 100;
if (!traffic || Number.isFinite(traffic.total) ||!Number.isFinite(planGB) || planGB <= 0) return traffic;
const total = planGB * (1024 ** 3);
return {
...traffic,
total,
used: Math.max(0, total - traffic.remaining),
partial: false,
totalEstimated: true,
source: `${traffic.source || 'body'}+env`
};
}

async function fetchSubscription(ctx, url) {
const customUA = String(ctx.env?.SUBSCRIPTION_USER_AGENT || '').trim();
const userAgents = [...new Set([
customUA,
'clash.meta',
'clash-verge/v2.2.3',
'Surge/5.0',
'Quantumult%20X/1.5.0'
].filter(Boolean))];

const extract = async response => {
const headerData = parseUserInfo(readHeader(response?.headers, 'subscription-userinfo'));
if (headerData) return headerData;
try {
return parseBodyInfo(await response.text());
} catch {
return null;
}
};

for (const userAgent of userAgents) {
try {
const response = await ctx.http.get(url, {
timeout: 8000,
redirect: 'manual',
headers: { 'User-Agent': userAgent}
});

const direct = await extract(response);
if (direct) return direct;

const location = readHeader(response.headers, 'location');
if (location && response.status >= 300 && response.status < 400) {
const target = new URL(location, url).toString();
const redirected = await ctx.http.get(target, {
timeout: 8000,
redirect: 'follow',
headers: { 'User-Agent': userAgent}
});
const final = await extract(redirected);
if (final) return final;
}
} catch {
// Try next
}
}

throw new Error('订阅未返回可识别的流量信息');
}

async function loadData(ctx) {
const url = userValue(ctx.env?.SUBSCRIPTION_URL) || userValue(MY_SUBSCRIPTION_URL);
const name = userValue(ctx.env?.SUBSCRIPTION_NAME) || userValue(MY_SUBSCRIPTION_NAME) || 'SUBSCRIPTION';
if (!url) return { mode: 'setup', name};

const key = storageKey(url);
try {
const traffic = applyPlanTotal(ctx, await fetchSubscription(ctx, url));
const result = { mode: 'live', name, traffic, updatedAt: Date.now()};
ctx.storage?.setJSON(key, result);
return result;
} catch (error) {
const cached = ctx.storage?.getJSON(key);
if (cached?.traffic) {
return {
...cached,
traffic: applyPlanTotal(ctx, cached.traffic),
mode: 'stale',
name,
error: String(error?.message || error)
};
}
return { mode: 'error', name, error: String(error?.message || error || '加载失败')};
}
}

function daysRemaining(expireAt) {
if (!expireAt) return null;
return Math.ceil((expireAt - Date.now()) / 86400000);
}

function statusOf(data) {
if (data.mode === 'setup') {
return { label: '待配置', icon: 'gearshape.fill', bgColor: 'rgba(255, 255, 255, 0.22)', iconColor: '#FFFFFF'};
}
if (data.mode === 'error') {
return { label: '更新失败', icon: 'exclamationmark.circle.fill', bgColor: 'rgba(214, 69, 69, 0.35)', iconColor: '#FF453A'};
}
if (data.mode === 'stale') {
return { label: '数据延迟', icon: 'clock.arrow.circlepath', bgColor: 'rgba(255, 159, 10, 0.3)', iconColor: '#FF9F0A'};
}

const traffic = data.traffic;
const days = daysRemaining(traffic.expireAt);
const ratio = traffic.unlimited ||!Number.isFinite(traffic.total) || traffic.total <= 0
? null
: traffic.remaining / traffic.total;

if ((!traffic.unlimited && traffic.remaining <= 0) || (days!= null && days <= 0)) {
return { label: '套餐已过期', icon: 'xmark.circle.fill', bgColor: 'rgba(214, 69, 69, 0.35)', iconColor: '#FF453A'};
}
if ((!traffic.unlimited && ratio!= null && ratio <= 0.2) ||
(traffic.partial && traffic.remaining <= 10 * (1024 ** 3)) ||
(days!= null && days <= 7)) {
return { label: '流量偏低', icon: 'exclamationmark.triangle.fill', bgColor: 'rgba(255, 159, 10, 0.3)', iconColor: '#FF9F0A'};
}

return { label: '数据已更新', icon: 'checkmark.circle.fill', bgColor: 'rgba(48, 209, 88, 0.25)', iconColor: '#30D158'};
}

// 剩余流量数字的颜色：充足绿 / 偏低橙 / 用完红
function remainingColor(traffic) {
if (!traffic.unlimited && traffic.remaining <= 0) return C.fail;
const ratio = traffic.unlimited ||!Number.isFinite(traffic.total) || traffic.total <= 0
? null
: traffic.remaining / traffic.total;
if (ratio!= null && ratio <= 0.2) return C.warn;
return C.ok;
}

function formatBytes(bytes, decimals = 1) {
if (!Number.isFinite(bytes)) return '不限量';
if (bytes <= 0) return '0 B';
const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
const value = bytes / (1024 ** index);
const digits = value >= 100? 0: value >= 10? Math.min(1, decimals): decimals;
return `${value.toFixed(digits)} ${units[index]}`;
}

function formatDate(timestamp) {
if (!timestamp) return '长期有效';
const date = new Date(timestamp);
if (Number.isNaN(date.getTime())) return '--';
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
return `${year}-${month}-${day}`;
}

function percentRemaining(traffic) {
if (traffic.unlimited ||!Number.isFinite(traffic.total) || traffic.total <= 0) return null;
return Math.max(0, Math.min(100, (traffic.remaining / traffic.total) * 100));
}

function optionalBytes(value) {
return Number.isFinite(value)? formatBytes(value): '--';
}

function totalLabel(traffic) {
if (traffic.unlimited) return '不限量';
return optionalBytes(traffic.total);
}

function bytesToBase64(bytes) {
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let output = '';
for (let i = 0; i < bytes.length; i += 3) {
const a = bytes[i];
const b = i + 1 < bytes.length? bytes[i + 1]: 0;
const c = i + 2 < bytes.length? bytes[i + 2]: 0;
const triple = (a << 16) | (b << 8) | c;
output += alphabet[(triple >> 18) & 63];
output += alphabet[(triple >> 12) & 63];
output += i + 1 < bytes.length? alphabet[(triple >> 6) & 63]: '=';
output += i + 2 < bytes.length? alphabet[triple & 63]: '=';
}
return output;
}

async function loadGaugeImage(ctx, traffic) {
const remainingPercent = percentRemaining(traffic);
if (remainingPercent == null) return '';
const usedPercent = Math.round(Math.max(0, Math.min(100, 100 - remainingPercent)));
// 缓存键升级为 v6：仪表盘改成蓝色，避免继续使用旧的紫色图片
const cacheKey = `egern.subscription.gauge.png.v6.${usedPercent}`;
const cached = ctx.storage?.get(cacheKey);
if (cached) return cached;

const chart = {
type: 'doughnut',
data: {
datasets: [{
data: [usedPercent, Math.max(0.01, 100 - usedPercent)],
backgroundColor: ['#0A84FF', '#2C2C2E'],
borderColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
borderWidth: 1
}]
},
options: {
responsive: false,
animation: false,
rotation: 2.35619449,
circumference: 4.71238898,
cutoutPercentage: 82,
legend: { display: false},
tooltips: { enabled: false},
plugins: {
datalabels: { display: false},
doughnutlabel: {
labels: [
{ text: ' ', font: { size: 12, weight: 'normal', family: 'Helvetica Neue'}, color: 'rgba(0,0,0,0)'},
{ text: `${usedPercent}%`, font: { size: 36, weight: 'bold', family: 'Helvetica Neue'}, color: '#0A84FF'},
{ text: '已用', font: { size: 14, weight: 'normal', family: 'Helvetica Neue'}, color: '#8E8E93'}
]
}
}
}
};

const response = await ctx.http.post(GAUGE_API, {
timeout: 8000,
headers: { 'Content-Type': 'application/json'},
body: {
version: '2',
width: 280,
height: 200,
devicePixelRatio: 2,
format: 'png',
backgroundColor: 'transparent',
chart
}
});
if (response.status < 200 || response.status >= 300) throw new Error(`Gauge HTTP ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
if (!bytes.length) throw new Error('Gauge image is empty');
const dataUri = `data:image/png;base64,${bytesToBase64(bytes)}`;
ctx.storage?.set(cacheKey, dataUri);
return dataUri;
}

function icon(name, color, size = 14) {
return { type: 'image', src: `sf-symbol:${name}`, width: size, height: size, color};
}

function text(value, size, color, weight = 'regular', extra = {}) {
return {
type: 'text',
text: String(value),
font: { size, weight},
textColor: color,
maxLines: 1,
...extra
};
}

function header(data, isSmall = false) {
const status = statusOf(data);
const badge = isSmall
? {
type: 'stack',
direction: 'row',
alignItems: 'center',
justifyContent: 'center',
padding: [4, 7, 4, 7],
backgroundColor: status.bgColor,
borderRadius: 12,
children: [
icon(status.icon, status.iconColor, 12)
]
}
: {
type: 'stack',
direction: 'row',
alignItems: 'center',
gap: 5,
padding: [4, 10, 4, 8],
backgroundColor: status.bgColor,
borderRadius: 14,
children: [
icon(status.icon, status.iconColor, 13),
text(status.label, 10, '#FFFFFF', 'semibold')
]
};

const titleText = data.name || 'SUBSCRIPTION';

return {
type: 'stack',
direction: 'row',
alignItems: 'center',
gap: 6,
children: [
icon('chart.pie.fill', C.accent, 16),
text(titleText, 16, C.text, 'bold', { minScale: 0.6}),
{ type: 'spacer'},
badge
]
};
}

function progressBar(traffic) {
const percent = percentRemaining(traffic);
if (percent == null) {
return {
type: 'stack',
direction: 'row',
height: 5,
backgroundColor: C.track,
borderRadius: 3,
children: [{
type: 'stack',
height: 5,
backgroundColor: C.accent,
borderRadius: 3,
flex: 1,
children: []
}]
};
}

const active = Math.max(0.001, percent);
const empty = Math.max(0.001, 100 - percent);

return {
type: 'stack',
direction: 'row',
height: 5,
backgroundColor: C.track,
borderRadius: 3,
children: [
{
type: 'stack',
height: 5,
backgroundColor: C.accent,
borderRadius: 3,
flex: active,
children: []
},
{
type: 'spacer',
flex: empty
}
]
};
}

function progressOrNote(traffic) {
const percent = percentRemaining(traffic);
if (percent == null &&!traffic.unlimited) {
return text('服务商仅提供剩余流量', 9, C.dim, 'medium');
}
return progressBar(traffic);
}

function fallbackGauge(traffic, size = 90) {
const remainingPercent = percentRemaining(traffic);
const usedPercent = remainingPercent == null? null: Math.max(0, Math.min(100, 100 - remainingPercent));
return {
type: 'stack',
direction: 'column',
alignItems: 'center',
width: size,
height: size,
gap: 3,
children: [
{ type: 'spacer'},
icon('gauge.with.dots.needle.33percent', C.accent, 46),
text(usedPercent == null? '--': `${usedPercent.toFixed(0)}%`, 14, C.text, 'bold', {
font: { size: 14, weight: 'bold', family: 'Menlo'}
}),
text('已用', 9, C.dim, 'semibold'),
{ type: 'spacer'}
]
};
}

function gaugeView(data, traffic, size = 86) {
if (!data.gaugeImage) return fallbackGauge(traffic, size);
return {
type: 'image',
src: data.gaugeImage,
width: size + 14,
height: size,
resizeMode: 'contain'
};
}

function metric(label, value, color = C.text) {
return {
type: 'stack',
direction: 'column',
gap: 2,
flex: 1,
children: [
text(label, 9, C.dim, 'semibold'),
text(value, 12, color, 'semibold', { minScale: 0.68})
]
};
}

function emptyWidget(data, family, ctx) {
const isSmall = family === 'systemSmall';
const refreshHours = numberEnv(ctx, 'REFRESH_HOURS', 2, 0.5, 24);
const mode = styleMode(ctx);
const setup = data.mode === 'setup';
return {
type: 'widget',
...rootBackground(mode),
padding: isSmall? [14, 16]: [16, 20],
gap: 8,
refreshAfter: new Date(Date.now() + refreshHours * 3600000).toISOString(),
children: [
header(data, isSmall),
{ type: 'spacer'},
{
type: 'stack',
direction: 'row',
children: [
{ type: 'spacer'},
{
type: 'stack',
direction: 'column',
alignItems: 'center',
gap: 6,
children: [
icon(setup? 'link.badge.plus': 'exclamationmark.triangle', setup? C.dim: C.fail, isSmall? 20: 22),
text(setup? '请填写订阅链接': '无法读取流量', isSmall? 13: 15, C.text, 'semibold'),
text(setup? '请在脚本顶部填写订阅链接': data.error, 9, C.dim, 'medium', { minScale: 0.65})
]
},
{ type: 'spacer'}
]
},
{ type: 'spacer'}
]
};
}

function mediumWidget(data, ctx) {
if (!data.traffic) return emptyWidget(data, 'systemMedium', ctx);
const traffic = data.traffic;
const days = daysRemaining(traffic.expireAt);
const refreshHours = numberEnv(ctx, 'REFRESH_HOURS', 2, 0.5, 24);
const mode = styleMode(ctx);
const daysText = days == null? '长期': `${Math.max(0, days)} 天`;

return {
type: 'widget',
...rootBackground(mode),
padding: [16, 20, 14, 20],
gap: 8,
refreshAfter: new Date(Date.now() + refreshHours * 3600000).toISOString(),
children: [
header(data, false),
{ type: 'spacer'},
{
type: 'stack',
direction: 'row',
alignItems: 'center',
gap: 12,
children: [
{
type: 'stack',
direction: 'column',
gap: 3,
flex: 1,
children: [
text(formatBytes(traffic.remaining), 26, remainingColor(traffic), 'bold', {
font: { size: 26, weight: 'bold', family: 'Menlo'},
minScale: 0.62
}),
text('剩余流量', 10, C.dim, 'medium'),
{
type: 'stack',
direction: 'row',
alignItems: 'center',
children: [
text(`已用 ${optionalBytes(traffic.used)}`, 10, C.dim, 'medium', { minScale: 0.72}),
{ type: 'spacer'},
text(`剩余 ${daysText}`, 10, C.dim, 'medium', { minScale: 0.72})
]
},
text(`到期 ${formatDate(traffic.expireAt)}`, 9, C.dim, 'medium', { minScale: 0.72}),
{ type: 'spacer'}
]
},
{
type: 'stack',
direction: 'column',
alignItems: 'center',
justifyContent: 'center',
gap: 2,
width: 100,
children: [
gaugeView(data, traffic, 86),
text(`套餐 ${totalLabel(traffic)}`, 9, C.dim, 'semibold', { minScale: 0.68})
]
}
]
},
{ type: 'spacer'}
]
};
}

function smallWidget(data, ctx) {
if (!data.traffic) return emptyWidget(data, 'systemSmall', ctx);
const traffic = data.traffic;
const percent = percentRemaining(traffic);
const refreshHours = numberEnv(ctx, 'REFRESH_HOURS', 2, 0.5, 24);
const mode = styleMode(ctx);
return {
type: 'widget',
...rootBackground(mode),
padding: [16, 18, 10, 18],
gap: 5,
refreshAfter: new Date(Date.now() + refreshHours * 3600000).toISOString(),
children: [
header(data, true),
{ type: 'spacer', flex: 1 },
text(formatBytes(traffic.remaining), 24, remainingColor(traffic), 'bold', {
font: { size: 24, weight: 'bold', family: 'Menlo'},
minScale: 0.58
}),
{ type: 'spacer', flex: 1 },
{
type: 'stack',
direction: 'row',
children: [
text('剩余流量', 11, C.dim, 'medium'),
{ type: 'spacer'},
text(traffic.unlimited? '∞': percent == null? '--': `${percent.toFixed(0)}%`, 11, C.accent, 'semibold')
]
},
{ type: 'spacer', flex: 1 },
progressOrNote(traffic),
{ type: 'spacer', flex: 1 },
text(`到期时间：${formatDate(traffic.expireAt)}`, 11, C.dim, 'medium')
]
};
}

function largeWidget(data, ctx) {
if (!data.traffic) return emptyWidget(data, 'systemLarge', ctx);
const traffic = data.traffic;
const percent = percentRemaining(traffic);
const days = daysRemaining(traffic.expireAt);
const refreshHours = numberEnv(ctx, 'REFRESH_HOURS', 2, 0.5, 24);
const mode = styleMode(ctx);
const daily = days && days > 0 && Number.isFinite(traffic.remaining)? traffic.remaining / days: null;

const cardBg = mode === '纯黑背景'? C.panel: 'rgba(255, 255, 255, 0.08)';
const hairlineBg = mode === '纯黑背景'? C.hairline: 'rgba(255, 255, 255, 0.12)';

return {
type: 'widget',
...rootBackground(mode),
padding: [18, 20, 18, 20],
gap: 10,
refreshAfter: new Date(Date.now() + refreshHours * 3600000).toISOString(),
children: [
header(data, false),
{
type: 'stack',
direction: 'row',
alignItems: 'center',
gap: 12,
padding: [11, 14],
backgroundColor: cardBg,
borderRadius: 12,
children: [
icon('arrow.up.arrow.down.circle.fill', C.accent, 28),
{
type: 'stack',
direction: 'column',
gap: 2,
flex: 1,
children: [
text(formatBytes(traffic.remaining), 22, remainingColor(traffic), 'bold', {
font: { size: 22, weight: 'bold', family: 'Menlo'}, minScale: 0.6
}),
text('剩余流量', 10, C.dim, 'medium')
]
},
text(traffic.unlimited? '∞': percent == null? '--': `${percent.toFixed(0)}%`, 18, C.accent, 'bold')
]
},
progressOrNote(traffic),
{
type: 'stack',
direction: 'row',
gap: 12,
children: [
metric('下载', optionalBytes(traffic.download), COLOR_DOWNLOAD),
metric('上传', optionalBytes(traffic.upload), COLOR_UPLOAD),
metric('合计已用', optionalBytes(traffic.used), COLOR_USED)
]
},
{ type: 'stack', height: 1, backgroundColor: hairlineBg, children: []},
{
type: 'stack',
direction: 'row',
gap: 12,
children: [
metric('套餐总量', totalLabel(traffic)),
metric('剩余天数', days == null? '长期': `${Math.max(0, days)} 天`, COLOR_DAYS),
metric('日均可用', daily == null? '--': formatBytes(daily), COLOR_DAILY)
]
},
{ type: 'spacer'},
{
type: 'stack',
direction: 'row',
children: [
{ type: 'spacer'},
text(`到期 ${formatDate(traffic.expireAt)}`, 9, C.dim, 'semibold')
]
}
]
};
}

function lockWidget(data, family) {
if (!data.traffic) {
const label = data.mode === 'setup'? '订阅流量：待配置': '订阅流量：读取失败';
return { type: 'widget', children: [text(label, 12, C.text, 'semibold')]};
}
const traffic = data.traffic;
const percent = percentRemaining(traffic);
const remaining = formatBytes(traffic.remaining);
if (family === 'accessoryInline') {
return { type: 'widget', children: [text(`剩余 ${remaining}${percent == null? '': ` · ${percent.toFixed(0)}%`}`, 12, C.text, 'semibold')]};
}
if (family === 'accessoryCircular') {
return {
type: 'widget',
padding: 4,
children: [
icon('chart.pie.fill', C.text, 15),
text(traffic.unlimited? '∞': percent == null? '--': `${percent.toFixed(0)}%`, 12, C.text, 'bold', { textAlign: 'center'})
]
};
}
return {
type: 'widget',
gap: 2,
children: [
{
type: 'stack',
direction: 'row',
alignItems: 'center',
gap: 5,
children: [icon('chart.pie.fill', C.text, 12), text(data.name, 11, C.text, 'semibold')]
},
text(`剩余 ${remaining} · 到期 ${formatDate(traffic.expireAt)}`, 12, C.text, 'bold')
]
};
}

export default async function(ctx) {
const data = await loadData(ctx);
const family = ctx.widgetFamily || 'systemMedium';
if (family === 'systemMedium' && data.traffic) {
try {
data.gaugeImage = await loadGaugeImage(ctx, data.traffic);
} catch {
data.gaugeImage = '';
}
}
if (family.startsWith('accessory')) return lockWidget(data, family);
if (family === 'systemSmall') return smallWidget(data, ctx);
if (family === 'systemLarge' || family === 'systemExtraLarge') return largeWidget(data, ctx);
return mediumWidget(data, ctx);
}
