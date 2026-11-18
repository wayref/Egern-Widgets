export default async function(ctx) {
  const envSize = ctx.widgetFamily || 'systemMedium';
  const sizeStr = String(envSize).toLowerCase();
  
  const isSmall = sizeStr.includes('small');
  const isLarge = sizeStr.includes('large');

  // WIDGET_STYLE: 纯黑背景 / 毛玻璃纯黑 / 毛玻璃透明
  const style = (ctx.env.WIDGET_STYLE || '纯黑背景').trim();

  // 每个服务用哪个策略组测试，用户在环境变量里填策略组名，留空用默认
  function envOf(key) {
    const v = ctx.env ? ctx.env[key] : undefined;
    const s = (v === undefined || v === null) ? '' : String(v).trim();
    return s === '' ? undefined : s;
  }
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

  const fetchProxy = async (policy) => {
    const ts = Date.now();
    const opts = { timeout: 2500 };
    if (policy) opts.policy = policy;
    const res = await ctx.http.get(`http://ip-api.com/json/?lang=zh-CN&_t=${ts}`, opts).catch(() => null);
    if (!res) return { code: 'ERR', cc: 'XX' };
    const data = JSON.parse(await res.text());
    return { code: data.countryCode ? 'OK' : 'ERR', cc: data.countryCode || 'XX' };
  };
  
  async function checkYouTube() { const opts = { timeout: 3000, headers: commonHeaders }; const p = envOf('POLICY_YOUTUBE'); if (p) opts.policy = p; const res = await ctx.http.get(`https://www.youtube.com/generate_204`, opts).catch(() => null); return { code: res?.status === 204 ? 'OK' : 'ERR' }; }
  async function checkNetflix() { 
    const opts = { timeout: 5000, headers: commonHeaders, followRedirect: true }; const p_netflix = envOf('POLICY_NETFLIX'); if (p_netflix) opts.policy = p_netflix;
    const res = await ctx.http.get(`https://www.netflix.com/`, opts).catch(() => null);
    return { code: res?.status === 200 ? 'OK' : 'ERR' };
  }
  async function checkSpotify() { const opts = { timeout: 3000, headers: commonHeaders, followRedirect: false }; const p_spotify = envOf('POLICY_SPOTIFY'); if (p_spotify) opts.policy = p_spotify; const res = await ctx.http.get(`https://open.spotify.com/`, opts).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }
  async function checkChatGPT() { const opts = { timeout: 3000, headers: commonHeaders, followRedirect: false }; const p_chatgpt = envOf('POLICY_CHATGPT'); if (p_chatgpt) opts.policy = p_chatgpt; const res = await ctx.http.get(`https://chatgpt.com/`, opts).catch(() => null); return { code: (res && res.status !== 403 && res.status !== 429) ? 'OK' : 'ERR' }; }
  async function checkClaude() { const opts = { timeout: 3000, headers: commonHeaders, followRedirect: false }; const p_claude = envOf('POLICY_CLAUDE'); if (p_claude) opts.policy = p_claude; const res = await ctx.http.get(`https://claude.ai/login`, opts).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }
  async function checkGemini() { const opts = { timeout: 3000, headers: commonHeaders, followRedirect: false }; const p_gemini = envOf('POLICY_GEMINI'); if (p_gemini) opts.policy = p_gemini; const res = await ctx.http.get(`https://gemini.google.com/app`, opts).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }
  async function checkGrok() { const opts = { timeout: 3000, headers: commonHeaders, followRedirect: false }; const p_grok = envOf('POLICY_GROK'); if (p_grok) opts.policy = p_grok; const res = await ctx.http.get(`https://grok.com/`, opts).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }
  async function checkTikTok() { const opts = { timeout: 3000, headers: commonHeaders, followRedirect: false }; const p_tiktok = envOf('POLICY_TIKTOK'); if (p_tiktok) opts.policy = p_tiktok; const res = await ctx.http.get(`https://www.tiktok.com/`, opts).catch(() => null); return { code: res && res.status === 200 ? 'OK' : 'ERR' }; }

  // 总超时 10 秒，防止某个服务卡住
  // 每个服务单独查地区，用各自的策略组
  const allChecks = await Promise.race([
    Promise.all([
      timed(() => fetchProxy(envOf('POLICY_YOUTUBE'))),
      timed(() => fetchProxy(envOf('POLICY_NETFLIX'))),
      timed(() => fetchProxy(envOf('POLICY_TIKTOK'))),
      timed(() => fetchProxy(envOf('POLICY_SPOTIFY'))),
      timed(() => fetchProxy(envOf('POLICY_CHATGPT'))),
      timed(() => fetchProxy(envOf('POLICY_CLAUDE'))),
      timed(() => fetchProxy(envOf('POLICY_GEMINI'))),
      timed(() => fetchProxy(envOf('POLICY_GROK'))),
      timed(checkYouTube), timed(checkNetflix, 5000), timed(checkTikTok),
      timed(checkSpotify), timed(checkChatGPT), timed(checkClaude), timed(checkGemini), timed(checkGrok)
    ]),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Overall timeout')), 10000))
  ]).catch(() => {
    // 超时时返回全部 ERR
    const err = { code: 'ERR', ms: 0 };
    return [err, err, err, err, err, err, err, err, err, err, err, err, err, err, err, err];
  });

  const [proxyYT, proxyNF, proxyTT, proxySP, proxyCG, proxyCL, proxyGM, proxyGK, youtube, netflix, tiktok, spotify, chatgpt, claude, gemini, grok] = allChecks;
  
  const resultInfo = (result, proxy) => {
    const available = result.code !== 'ERR';
    return { available, region: available ? (proxy.cc || 'XX') : '--', ms: result.ms || 0 };
  };
  
  const allServices = [
    { name: 'YouTube', info: resultInfo(youtube, proxyYT) }, { name: 'Netflix', info: resultInfo(netflix, proxyNF) },
    { name: 'TikTok', info: resultInfo(tiktok, proxyTT) }, { name: 'Spotify', info: resultInfo(spotify, proxySP) },
    { name: 'ChatGPT', info: resultInfo(chatgpt, proxyCG) }, { name: 'Claude', info: resultInfo(claude, proxyCL) },
    { name: 'Gemini', info: resultInfo(gemini, proxyGM) }, { name: 'Grok', info: resultInfo(grok, proxyGK) }
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
      type: 'stack', direction: 'column', flex: 1, gap: 4,
      children: [
        { type: 'stack', direction: 'column', gap: 4, alignItems: 'center', children: [
          { type: 'stack', direction: 'row', alignItems: 'center', children: [
            { type: 'stack', width: 6, height: 6, borderRadius: 3, backgroundColor: item.info.available ? C.ok : C.fail },
            { type: 'stack', width: 6 },
            { type: 'text', text: item.name, font: { size: 11, weight: 'semibold' }, textColor: C.text, maxLines: 1 }
          ]},
          { type: 'stack', direction: 'row', alignItems: 'center', children: [
            { type: 'text', text: `${getFlagEmoji(item.info.region)} ${item.info.region}`, font: { size: 10, weight: 'medium', design: 'monospaced' }, textColor: C.dim },
            { type: 'stack', width: 4 },
            { type: 'text', text: `${item.info.ms}ms`, font: { size: 9, weight: 'medium', design: 'monospaced' }, textColor: responseColor(item.info.ms, item.info.available) }
          ]}
        ]}
      ]
    });
    return {
      type: 'widget', ...rootBackground(), padding: [14, 14, 14, 14], gap: 10,
      children: [
        renderHeader(),
        { type: 'stack', direction: 'column', gap: 8, flex: 1, children: [
          { type: 'stack', direction: 'row', gap: 6, flex: 1, justifyContent: 'space-between', children: allServices.slice(0, 4).map(MediumServiceBlock) },
          { type: 'stack', direction: 'row', gap: 6, flex: 1, justifyContent: 'space-between', children: allServices.slice(4, 8).map(MediumServiceBlock) }
        ]}
      ]
    };
  };

  const renderLarge = () => {
    const LargeServiceBlock = (item) => ({
      type: 'stack', direction: 'column', flex: 1, gap: 6,
      children: [
        { type: 'stack', direction: 'column', gap: 6, alignItems: 'center', children: [
          { type: 'stack', direction: 'row', alignItems: 'center', children: [
            { type: 'stack', width: 7, height: 7, borderRadius: 3.5, backgroundColor: item.info.available ? C.ok : C.fail },
            { type: 'stack', width: 6 },
            { type: 'text', text: item.name, font: { size: 13, weight: 'semibold' }, textColor: C.text }
          ]},
          { type: 'stack', direction: 'row', alignItems: 'center', children: [
            { type: 'text', text: `${getFlagEmoji(item.info.region)} ${item.info.region}`, font: { size: 11, weight: 'medium', design: 'monospaced' }, textColor: C.dim },
            { type: 'stack', width: 6 },
            { type: 'text', text: `${item.info.ms}ms`, font: { size: 11, weight: 'medium', design: 'monospaced' }, textColor: responseColor(item.info.ms, item.info.available) }
          ]}
        ]}
      ]
    });
    const rows = [];
    for (let i = 0; i < 8; i += 2) {
      rows.push({ type: 'stack', direction: 'row', gap: 10, flex: 1, justifyContent: 'space-between', children: [LargeServiceBlock(allServices[i]), LargeServiceBlock(allServices[i+1])] });
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
