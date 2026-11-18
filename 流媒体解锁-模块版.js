// 流媒体解锁 - Egern 小组件
// 检测 8 个流媒体/AI 服务的解锁状态
// 作者：milull/milu 原版，QT 改编

const C = {
  bg: '#000000',
  text: '#FFFFFF',
  dim: '#8E8E93',
  secondary: '#D1D1D6',
  accent: '#0A84FF',
  ok: '#30D158',
  warn: '#FF9F0A',
  fail: '#FF453A',
  track: '#2C2C2E'
};

const SERVICES = [
  { name: 'YouTube', key: 'youtube', testUrl: 'https://www.youtube.com/', region: 'US' },
  { name: 'Netflix', key: 'netflix', testUrl: 'https://www.netflix.com/', region: 'US' },
  { name: 'TikTok', key: 'tiktok', testUrl: 'https://www.tiktok.com/', region: 'US' },
  { name: 'Spotify', key: 'spotify', testUrl: 'https://open.spotify.com/', region: 'US' },
  { name: 'ChatGPT', key: 'chatgpt', testUrl: 'https://chatgpt.com/', region: 'US' },
  { name: 'Claude', key: 'claude', testUrl: 'https://claude.ai/', region: 'US' },
  { name: 'Gemini', key: 'gemini', testUrl: 'https://gemini.google.com/', region: 'US' },
  { name: 'Grok', key: 'grok', testUrl: 'https://grok.com/', region: 'US' }
];

function getFlagEmoji(region) {
  const flags = {
    'US': '🇺🇸', 'HK': '🇭🇰', 'SG': '🇸🇬', 'JP': '🇯🇵', 'KR': '🇰🇷',
    'TW': '🇹🇼', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 'CA': '🇨🇦',
    'AU': '🇦🇺', 'NL': '🇳🇱', 'CH': '🇨🇭', 'SE': '🇸🇪', 'NO': '🇳🇴'
  };
  return flags[region] || '🌐';
}

function responseColor(ms, available) {
  if (!available) return C.fail;
  if (ms < 300) return C.ok;
  if (ms < 800) return C.warn;
  return C.fail;
}

async function testService(service) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(service.testUrl, { 
      method: 'HEAD', 
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);
    const ms = Date.now() - start;
    return { available: res.status < 400, ms, region: service.region };
  } catch (e) {
    return { available: false, ms: 0, region: service.region };
  }
}

async function getIPRegion() {
  try {
    const res = await fetch('https://ipapi.co/country_code/', { timeout: 5000 });
    const code = await res.text();
    return code.trim() || 'US';
  } catch (e) {
    return 'US';
  }
}

async function main() {
  const region = await getIPRegion();
  const results = await Promise.all(SERVICES.map(async (s) => {
    const info = await testService(s);
    return { ...s, info: { ...info, region } };
  }));
  
  const okCount = results.filter(r => r.info.available).length;
  const lockedCount = results.length - okCount;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const widget = $widget;
  
  if (widget.family === 'small') {
    return {
      type: 'widget', backgroundColor: C.bg, padding: [10, 14, 10, 14],
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', padding: [0, 0, 4, 0], children: [
          { type: 'image', src: 'sf-symbol:antenna.radiowaves.left.and.right', color: lockedCount === 0 ? C.ok : C.accent, width: 12, height: 12 },
          { type: 'stack', width: 6 },
          { type: 'text', text: '流媒体解锁', font: { size: 11, weight: 'bold' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'text', text: `${okCount}/${results.length}`, font: { size: 10, weight: 'bold', design: 'monospaced' }, textColor: lockedCount === 0 ? C.ok : C.fail },
          { type: 'stack', width: 8 },
          { type: 'text', text: time, font: { size: 10, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
        ]},
        { type: 'stack', direction: 'column', flex: 1, justifyContent: 'space-between', gap: 2, children: results.map(item => ({
          type: 'stack', direction: 'row', alignItems: 'center', children: [
            { type: 'stack', width: 5, height: 5, borderRadius: 2.5, backgroundColor: item.info.available ? C.ok : C.fail },
            { type: 'stack', width: 6 },
            { type: 'text', text: item.name, font: { size: 11, weight: 'semibold' }, textColor: C.text, maxLines: 1 },
            { type: 'spacer' },
            { type: 'text', text: `${getFlagEmoji(item.info.region)} ${item.info.region}`, font: { size: 10, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
          ]
        }))}
      ]
    };
  }
  
  if (widget.family === 'medium') {
    const MediumServiceBlock = (item) => ({
      type: 'stack', direction: 'row', flex: 1, children: [
        { type: 'stack', direction: 'column', gap: 4, children: [
          { type: 'stack', width: 6, height: 6, borderRadius: 3, backgroundColor: item.info.available ? C.ok : C.fail },
          { type: 'text', text: item.info.region, font: { size: 10, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
        ]},
        { type: 'stack', width: 6 },
        { type: 'stack', direction: 'column', gap: 4, flex: 1, children: [
          { type: 'text', text: item.name, font: { size: 11, weight: 'semibold' }, textColor: C.text, maxLines: 1 },
          { type: 'text', text: `${item.info.ms}ms`, font: { size: 9, weight: 'medium', design: 'monospaced' }, textColor: responseColor(item.info.ms, item.info.available) }
        ]}
      ]
    });
    
    return {
      type: 'widget', backgroundColor: C.bg, padding: [14, 14, 14, 14], gap: 10,
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', children: [
          { type: 'image', src: 'sf-symbol:antenna.radiowaves.left.and.right', color: lockedCount === 0 ? C.ok : C.accent, width: 14, height: 14 },
          { type: 'stack', width: 6 },
          { type: 'text', text: '流媒体解锁', font: { size: 13, weight: 'bold' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'text', text: `${okCount}/${results.length}`, font: { size: 11, weight: 'bold', design: 'monospaced' }, textColor: lockedCount === 0 ? C.ok : C.fail },
          { type: 'stack', width: 8 },
          { type: 'text', text: time, font: { size: 11, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
        ]},
        { type: 'stack', direction: 'column', flex: 1, justifyContent: 'space-between', gap: 8, children: [
          { type: 'stack', direction: 'row', gap: 6, children: results.slice(0, 4).map(MediumServiceBlock) },
          { type: 'stack', direction: 'row', gap: 6, children: results.slice(4, 8).map(MediumServiceBlock) }
        ]}
      ]
    };
  }
  
  // Large
  const LargeServiceBlock = (item) => ({
    type: 'stack', direction: 'row', flex: 1, children: [
      { type: 'stack', direction: 'column', gap: 6, children: [
        { type: 'stack', width: 7, height: 7, borderRadius: 3.5, backgroundColor: item.info.available ? C.ok : C.fail },
        { type: 'text', text: `${getFlagEmoji(item.info.region)} ${item.info.region}`, font: { size: 11, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
      ]},
      { type: 'stack', width: 6 },
      { type: 'stack', direction: 'column', gap: 6, flex: 1, children: [
        { type: 'text', text: item.name, font: { size: 13, weight: 'semibold' }, textColor: C.text },
        { type: 'text', text: `${item.info.ms}ms`, font: { size: 11, weight: 'medium', design: 'monospaced' }, textColor: responseColor(item.info.ms, item.info.available) }
      ]}
    ]
  });
  
  const rows = [];
  for (let i = 0; i < 8; i += 2) {
    rows.push({ type: 'stack', direction: 'row', gap: 10, flex: 1, children: [LargeServiceBlock(results[i]), LargeServiceBlock(results[i+1])] });
  }
  
  return {
    type: 'widget', backgroundColor: C.bg, padding: [16, 16, 16, 16], gap: 12,
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', children: [
        { type: 'image', src: 'sf-symbol:antenna.radiowaves.left.and.right', color: lockedCount === 0 ? C.ok : C.accent, width: 16, height: 16 },
        { type: 'stack', width: 8 },
        { type: 'text', text: '流媒体解锁', font: { size: 15, weight: 'bold' }, textColor: C.text },
        { type: 'spacer' },
        { type: 'text', text: `${okCount}/${results.length}`, font: { size: 13, weight: 'bold', design: 'monospaced' }, textColor: lockedCount === 0 ? C.ok : C.fail },
        { type: 'stack', width: 8 },
        { type: 'text', text: time, font: { size: 13, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
      ]},
      { type: 'stack', direction: 'column', flex: 1, justifyContent: 'space-between', gap: 10, children: rows }
    ]
  };
}

main().then(widget => $done(widget));
