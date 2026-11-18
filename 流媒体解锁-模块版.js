export default async function(ctx) {
  const envSize = ctx.widgetFamily || 'systemMedium';
  const sizeStr = String(envSize).toLowerCase();
  
  const isSmall = sizeStr.includes('small');
  const isLarge = sizeStr.includes('large');

  // WIDGET_STYLE: 纯黑背景 / 毛玻璃纯黑 / 毛玻璃透明
  const style = (ctx.env.WIDGET_STYLE || '纯黑背景').trim();
  const rootBackground = (mode) => {
    if (style === '毛玻璃透明') return {};
    if (style === '毛玻璃纯黑') return { backgroundColor: 'rgba(0,0,0,0.55)' };
    return { backgroundColor: '#000000' };
  };

  const C = {
    bg: '#000000',
    text: '#FFFFFF',
    dim: '#8E8E93',
    secondary: '#D1D1D6',
    track: '#2C2C2E',
    accent: '#0A84FF',
    ok: '#30D158',
    warn: '#FF9F0A',
    fail: '#FF453A',
  };
  
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache'
  };
  
  const getFlagEmoji = (cc) => {
    if (!cc || cc === 'XX' || cc === '--') return '🌐';
    return cc.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
  };

  async function timed(fn, timeoutMs = 3000) {
    const start = Date.now();
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
      ]);
      return { ...result, ms: Date.now() - start };
    } catch {
      return { code: 'ERR', ms: Date.now() - start };
    }
  }

  const fetchProxy = async () => {
    const ts = Date.now();
    const res = await ctx.http.get(`http://ip-api.com/json/?lang=zh-CN&_t=${ts}`, { timeout: 2500 }).catch(() => null);
    if (!res) return { code: 'ERR', cc: 'XX' };
    const data = JSON.parse(await res.text());
    return { code: data.countryCode ? 'OK' : 'ERR', cc: data.countryCode || 'XX' };
  };
  
  async function checkYouTube() { const res = await ctx.http.get(`https://www.youtube.com/generate_204`, { timeout: 3000, headers: commonHeaders }).catch(() => null); return { code: res?.status === 204 ? 'OK' : 'ERR' }; }
  async function checkNetflix() { 
    const res = await ctx.http.get(`https://www.netflix.com/`, { timeout: 5000, headers: commonHeaders, followRedirect: true }).catch(() => null);
    return { code: res?.status === 200 ? 'OK' : 'ERR' };
  }
  async function checkSpotify() { const res = await ctx.http.get(`https://open.spotify.com/`, { timeout: 3000, headers: commonHeaders, followRedirect: false }).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }
  async function checkChatGPT() { const res = await ctx.http.get(`https://chatgpt.com/`, { timeout: 3000, headers: commonHeaders, followRedirect: false }).catch(() => null); return { code: (res && res.status !== 403 && res.status !== 429) ? 'OK' : 'ERR' }; }
  async function checkClaude() { const res = await ctx.http.get(`https://claude.ai/login`, { timeout: 3000, headers: commonHeaders, followRedirect: false }).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }
  async function checkGemini() { const res = await ctx.http.get(`https://gemini.google.com/app`, { timeout: 3000, headers: commonHeaders, followRedirect: false }).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }
  async function checkGrok() { const res = await ctx.http.get(`https://grok.com/`, { timeout: 3000, headers: commonHeaders, followRedirect: false }).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }
  async function checkTikTok() { const res = await ctx.http.get(`https://www.tiktok.com/`, { timeout: 3000, headers: commonHeaders, followRedirect: false }).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }

  // 总超时 10 秒，防止某个服务卡住
  const allChecks = await Promise.race([
    Promise.all([
      timed(fetchProxy), timed(checkYouTube), timed(checkNetflix, 5000), timed(checkTikTok),
      timed(checkSpotify), timed(checkChatGPT), timed(checkClaude), timed(checkGemini), timed(checkGrok)
    ]),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Overall timeout')), 10000))
  ]).catch(() => {
    // 超时时返回全部 ERR
    const err = { code: 'ERR', ms: 0 };
    return [err, err, err, err, err, err, err, err, err];
  });

  const [proxy, youtube, netflix, tiktok, spotify, chatgpt, claude, gemini, grok] = allChecks;
  
  const resultInfo = (result) => {
    const available = result.code !== 'ERR';
    return { available, region: available ? (proxy.cc || 'XX') : '--', ms: result.ms || 0 };
  };
  
  const allServices = [
    { name: 'YouTube', info: resultInfo(youtube) }, { name: 'Netflix', info: resultInfo(netflix) },
    { name: 'TikTok', info: resultInfo(tiktok) }, { name: 'Spotify', info: resultInfo(spotify) },
    { name: 'ChatGPT', info: resultInfo(chatgpt) }, { name: 'Claude', info: resultInfo(claude) },
    { name: 'Gemini', info: resultInfo(gemini) }, { name: 'Grok', info: resultInfo(grok) }
  ];
  
  const okCount = allServices.filter(s => s.info.available).length;
  const lockedCount = allServices.length - okCount;
  const time = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const responseColor = (ms, available) => !available ? C.fail : (ms >= 1500 ? C.warn : C.dim);

  const renderHeader = () => ({
    type: 'stack', direction: 'row', alignItems: 'center', children: [
      { type: 'image', src: 'sf-symbol:antenna.radiowaves.left.and.right', color: lockedCount === 0 ? C.ok : C.accent, width: 14, height: 14 },
      { type: 'stack', width: 8 },
      { type: 'text', text: '流媒体解锁', font: { size: 14, weight: 'bold' }, textColor: C.text },
      { type: 'spacer' },
      { type: 'text', text: `${okCount}/${allServices.length}`, font: { size: 12, weight: 'bold', design: 'monospaced' }, textColor: lockedCount === 0 ? C.ok : C.fail },
      { type: 'stack', width: 8 },
      { type: 'text', text: time, font: { size: 12, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
    ]
  });

  const renderSmall = () => {
    return {
      type: 'widget', ...rootBackground(), padding: [10, 14, 10, 14],
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', padding: [0, 0, 4, 0], children: [
          { type: 'image', src: 'sf-symbol:antenna.radiowaves.left.and.right', color: lockedCount === 0 ? C.ok : C.accent, width: 12, height: 12 },
          { type: 'stack', width: 6 },
          { type: 'text', text: '流媒体解锁', font: { size: 11, weight: 'bold' }, textColor: C.text },
          { type: 'spacer' },
          { type: 'text', text: `${okCount}/${allServices.length}`, font: { size: 10, weight: 'bold', design: 'monospaced' }, textColor: lockedCount === 0 ? C.ok : C.fail },
          { type: 'stack', width: 8 },
          { type: 'text', text: time, font: { size: 10, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
        ]},
        { type: 'stack', direction: 'column', flex: 1, justifyContent: 'space-between', gap: 2, children: allServices.map(item => ({
          type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
            { type: 'stack', width: 5, height: 5, borderRadius: 2.5, backgroundColor: item.info.available ? C.ok : C.fail },
            { type: 'text', text: item.name, font: { size: 11, weight: 'semibold' }, textColor: C.text, maxLines: 1 },
            { type: 'spacer' },
            { type: 'text', text: `${getFlagEmoji(item.info.region)} ${item.info.region}`, font: { size: 10, weight: 'medium', design: 'monospaced' }, textColor: C.dim }
          ]
        }))}
      ]
    };
  };

  const renderMedium = () => {
    const MediumServiceBlock = (item) => ({
      type: 'stack', direction: 'column', flex: 1, gap: 4, alignItems: 'start',
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', children: [
          { type: 'stack', width: 6, height: 6, borderRadius: 3, backgroundColor: item.info.available ? C.ok : C.fail },
          { type: 'stack', width: 6 },
          { type: 'text', text: item.name, font: { size: 11, weight: 'semibold' }, textColor: C.text, flex: 1, maxLines: 1 }
        ]},
        { type: 'stack', direction: 'row', alignItems: 'center', children: [
          { type: 'text', text: item.info.region, font: { size: 10, weight: 'medium', design: 'monospaced' }, textColor: C.dim, textAlign: 'left' },
          { type: 'stack', width: 4 },
          { type: 'text', text: `${item.info.ms}ms`, font: { size: 9, weight: 'medium', design: 'monospaced' }, textColor: responseColor(item.info.ms, item.info.available) }
        ]}
      ]
    });
    return {
      type: 'widget', ...rootBackground(), padding: [14, 14, 14, 14], gap: 10,
      children: [
        renderHeader(),
        { type: 'stack', direction: 'column', gap: 8, flex: 1, children: [
          { type: 'stack', direction: 'row', gap: 6, children: allServices.slice(0, 4).map(MediumServiceBlock) },
          { type: 'stack', direction: 'row', gap: 6, children: allServices.slice(4, 8).map(MediumServiceBlock) }
        ]}
      ]
    };
  };

  const renderLarge = () => {
    const LargeServiceBlock = (item) => ({
      type: 'stack', direction: 'column', flex: 1, gap: 6, alignItems: 'start',
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', children: [
          { type: 'stack', width: 7, height: 7, borderRadius: 3.5, backgroundColor: item.info.available ? C.ok : C.fail },
          { type: 'stack', width: 6 },
          { type: 'text', text: item.name, font: { size: 13, weight: 'semibold' }, textColor: C.text, flex: 1 }
        ]},
        { type: 'stack', direction: 'row', alignItems: 'center', children: [
          { type: 'text', text: `${getFlagEmoji(item.info.region)} ${item.info.region}`, font: { size: 11, weight: 'medium', design: 'monospaced' }, textColor: C.dim, textAlign: 'left' },
          { type: 'stack', width: 6 },
          { type: 'text', text: `${item.info.ms}ms`, font: { size: 11, weight: 'medium', design: 'monospaced' }, textColor: responseColor(item.info.ms, item.info.available) }
        ]}
      ]
    });
    const rows = [];
    for (let i = 0; i < 8; i += 2) {
      rows.push({ type: 'stack', direction: 'row', gap: 10, flex: 1, children: [LargeServiceBlock(allServices[i]), LargeServiceBlock(allServices[i+1])] });
    }
    return {
      type: 'widget', ...rootBackground(), padding: [16, 16, 16, 16], gap: 10,
      children: [
        renderHeader(),
        { type: 'stack', direction: 'column', gap: 10, flex: 1, children: rows }
      ]
    };
  };

  if (isSmall) return renderSmall();
  if (isLarge) return renderLarge();
  return renderMedium();
}
