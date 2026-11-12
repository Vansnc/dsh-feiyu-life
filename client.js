/**
 * dsh-feiyu-life · browser half (Settings -> 鱼的生活)
 *
 * Same plugin convention: window.__ModuleLoader__.load({ id, factory }), React via require.
 *
 * Pages:
 *   · now    : timeline chart + what gets injected + why (evidence); preview other times.
 *   · year   : term / vacation / exam week / festivals — decide which routine applies.
 *   · week   : timetable per weekday.
 *   · day    : routine tables (日常 / 晚起 / 假期 / 备考), late-rise days.
 *   · body   : cycle, deviation probabilities.
 *   · events : small events by section (上午/中午/下午/晚上).
 *
 * Edits live on the local config first; "保存" persists. Identifiers are English;
 * persisted config keys stay Chinese (they are the settings contract).
 */
window.__ModuleLoader__.load({
  id: 'dsh-feiyu-life',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect } = React

    const API = '/dsh-feiyu-life'
    const phoneOptions = ['在手', '静音', '在床头', '不在手边']
    const sectionOptions = ['上午', '中午', '下午', '晚上']
    const routineTables = [['日常', '日常（有课的日子）'], ['晚起', '晚起（周四那种）'], ['假期', '假期'], ['备考', '备考（考试周）']]
    const weekdayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const tabs = [['now', '此刻'], ['map', '地图'], ['year', '年度'], ['week', '课表'], ['day', '作息'], ['body', '身体'], ['events', '事件'], ['photo', '照片']]

    const CSS = `
[data-fl-wrap]{--fl-accent:#167f78;--fl-accent-soft:rgba(22,127,120,.12);--fl-warm:#d97732;--fl-line:rgba(127,127,127,.18);display:flex;flex-direction:column;gap:16px;padding:6px 2px 28px;color-scheme:light dark;font-size:13px;max-width:1080px;}
[data-fl-wrap] select{background:Canvas;color:CanvasText;}
[data-fl-wrap] select option{background:Canvas;color:CanvasText;}
[data-fl-sec]{display:flex;flex-direction:column;gap:8px;}
[data-fl-hero]{position:relative;overflow:hidden;padding:20px;border:1px solid var(--fl-line);border-radius:16px;background:linear-gradient(135deg,var(--fl-accent-soft),rgba(217,119,50,.08));}
[data-fl-hero]::after{content:'◌';position:absolute;right:18px;top:-22px;font-size:92px;color:var(--fl-accent);opacity:.10;}
[data-fl-title]{font-size:22px;font-weight:750;letter-spacing:-.02em;}
[data-fl-subtitle]{margin-top:5px;font-size:12.5px;opacity:.66;line-height:1.55;}
[data-fl-stats]{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px;}
[data-fl-stat]{min-width:0;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.46);border:1px solid rgba(127,127,127,.12);}
@media (prefers-color-scheme:dark){[data-fl-stat]{background:rgba(0,0,0,.16);}}
[data-fl-stat-k]{font-size:10.5px;opacity:.55;margin-bottom:3px;}
[data-fl-stat-v]{font-size:12.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-fl-actions]{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;background:Canvas;border-bottom:1px solid var(--fl-line);}
[data-fl-dirty]{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--fl-warm);}
[data-fl-dirty]::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;}
[data-fl-h]{font-size:13px;font-weight:650;opacity:.9;padding-top:10px;border-top:1px solid var(--fl-line);}
[data-fl-note]{font-size:12px;opacity:.62;line-height:1.55;}
[data-fl-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
[data-fl-tabs]{display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid rgba(127,127,127,.2);}
[data-fl-tab]{padding:5px 12px;border-radius:7px;border:1px solid transparent;background:transparent;color:inherit;font-size:13px;cursor:pointer;opacity:.72;}
[data-fl-tab]:hover{background:rgba(127,127,127,.10);opacity:1;}
[data-fl-tab][data-fl-on]{background:var(--fl-accent-soft);border-color:rgba(22,127,120,.35);color:var(--fl-accent);opacity:1;font-weight:650;}
[data-fl-input]{padding:5px 8px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font-size:12.5px;}
[data-fl-input]:focus{outline:2px solid rgba(22,127,120,.35);border-color:var(--fl-accent);outline-offset:1px;}
[data-fl-btn]{padding:6px 12px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font-size:13px;cursor:pointer;}
[data-fl-btn]:hover{background:rgba(127,127,127,.12);}
[data-fl-btn][disabled]{opacity:.5;cursor:default;}
[data-fl-btn][data-fl-main]{border-color:var(--fl-accent);background:var(--fl-accent);color:white;font-weight:650;}
[data-fl-btn][data-fl-main]:hover{filter:brightness(.95);background:var(--fl-accent);}
[data-fl-del]{padding:3px 8px;border-radius:6px;border:1px solid transparent;background:transparent;color:rgba(210,90,90,.9);cursor:pointer;font-size:12px;}
[data-fl-del]:hover{background:rgba(210,90,90,.12);}
[data-fl-msg]{font-size:12px;opacity:.8;min-height:16px;}
[data-fl-warn]{padding:9px 11px;border-radius:9px;border:1px solid rgba(217,119,50,.32);background:rgba(217,119,50,.09);font-size:12px;line-height:1.55;}
[data-fl-prev]{padding:10px 12px;border-radius:10px;background:rgba(127,127,127,.08);white-space:pre-wrap;line-height:1.7;font-size:13px;}
[data-fl-why]{display:flex;gap:6px;flex-wrap:wrap;}
[data-fl-chip]{padding:2px 8px;border-radius:999px;background:rgba(127,127,127,.12);font-size:11.5px;opacity:.85;}
[data-fl-table]{width:100%;border-collapse:collapse;}
[data-fl-table] th{font-weight:500;font-size:11.5px;opacity:.55;text-align:left;padding:2px 6px;}
[data-fl-table] td{padding:3px 6px;vertical-align:middle;}
[data-fl-table] tr+tr td{border-top:1px solid rgba(127,127,127,.10);}
[data-fl-num]{width:78px;}
[data-fl-narrow]{width:92px;}
[data-fl-wide]{width:100%;min-width:220px;}
[data-fl-empty]{font-size:12px;opacity:.55;padding:6px 2px;}
[data-fl-tl]{margin-top:4px;display:flex;flex-direction:column;gap:5px;}
[data-fl-tl-row]{display:flex;align-items:center;gap:8px;}
[data-fl-tl-time]{flex:0 0 100px;text-align:right;font-size:10.5px;opacity:.6;font-variant-numeric:tabular-nums;}
[data-fl-ticks]{position:relative;flex:0 0 58%;height:16px;font-size:10px;opacity:.55;}
[data-fl-ticks]>span{position:absolute;transform:translateX(-50%);}
[data-fl-now-mark]{position:absolute;transform:translateX(-50%);top:-1px;color:#ff5252;font-weight:600;white-space:nowrap;}
[data-fl-track]{position:relative;flex:0 0 58%;height:16px;border-radius:5px;background:rgba(127,127,127,.10);}
[data-fl-seg]{position:absolute;top:0;bottom:0;border-radius:5px;min-width:2px;}
[data-fl-seg][data-fl-src='plan']{background:#8b93a1;}
[data-fl-seg][data-fl-src='adjust']{background:#e08a1e;}
[data-fl-seg][data-fl-src='travel']{background:#4b88d1;}
[data-fl-tl-what]{flex:1;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-fl-tl-src]{font-style:normal;font-size:10px;opacity:.75;margin-left:6px;padding:1px 6px;border-radius:999px;background:rgba(127,127,127,.14);}
[data-fl-tl-row][data-fl-cur] [data-fl-seg]{box-shadow:0 0 0 2px rgba(255,82,82,.75);}
[data-fl-tl-row][data-fl-cur] [data-fl-tl-what]{font-weight:600;}
[data-fl-legend]{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;opacity:.7;margin-top:6px;}
[data-fl-lg]{display:inline-flex;align-items:center;gap:4px;}
[data-fl-lg]::before{content:'';width:10px;height:10px;border-radius:3px;display:inline-block;}
[data-fl-lg][data-fl-src='plan']::before{background:#8b93a1;}
[data-fl-lg][data-fl-src='adjust']::before{background:#e08a1e;}
[data-fl-lg][data-fl-src='travel']::before{background:#4b88d1;}
[data-fl-map]{position:relative;isolation:isolate;width:100%;aspect-ratio:16/9;min-height:380px;overflow:visible;border:1px solid rgba(81,125,108,.22);border-radius:24px;background:radial-gradient(ellipse at 12% 18%,rgba(255,255,255,.86),transparent 24%),radial-gradient(ellipse at 78% 14%,rgba(255,244,190,.48),transparent 24%),linear-gradient(145deg,#edf4df 0%,#e2f0dc 48%,#d9ebe2 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.58),inset 0 -28px 60px rgba(85,138,114,.08),0 14px 34px rgba(40,79,68,.10);}
[data-fl-map]::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;background-image:radial-gradient(circle at 10% 20%,rgba(88,137,91,.10) 0 1.2px,transparent 1.4px),radial-gradient(circle at 70% 64%,rgba(255,255,255,.34) 0 1px,transparent 1.2px);background-size:22px 22px,18px 18px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.72),rgba(0,0,0,.18));}
[data-fl-map]::after{content:'';position:absolute;inset:8px;z-index:0;pointer-events:none;border:1px dashed rgba(89,133,112,.18);border-radius:18px;}
@media(prefers-color-scheme:dark){[data-fl-map]{border-color:rgba(145,195,171,.20);background:radial-gradient(ellipse at 12% 18%,rgba(103,148,129,.18),transparent 25%),radial-gradient(ellipse at 78% 14%,rgba(189,167,89,.12),transparent 25%),linear-gradient(145deg,#21342d 0%,#1d312d 52%,#1c2c31 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),inset 0 -28px 60px rgba(4,17,15,.24),0 14px 34px rgba(0,0,0,.18);}}
[data-fl-map-layers]{position:absolute;inset:0;z-index:0;overflow:hidden;border-radius:inherit;pointer-events:none;}
[data-fl-map-layer]{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;}
[data-fl-map-layer='base']{z-index:0;opacity:.68;}
[data-fl-map-layer='anime']{z-index:1;opacity:.94;mix-blend-mode:normal;}
[data-fl-map-layer='buildings']{z-index:2;opacity:.98;filter:drop-shadow(0 3px 2px rgba(65,85,75,.11));}
[data-fl-map][data-map-style='xueyuan-road']::before{z-index:2;opacity:.18;}
[data-fl-map][data-map-style='xueyuan-road'] [data-fl-map-scenery]{display:none;}
@media(prefers-color-scheme:dark){[data-fl-map-layer='base']{opacity:.18;filter:brightness(.30) saturate(.52) hue-rotate(12deg);}[data-fl-map-layer='anime']{opacity:.90;mix-blend-mode:normal;filter:brightness(.72) saturate(.95);}[data-fl-map-layer='buildings']{opacity:.58;filter:brightness(.72) saturate(.74) drop-shadow(0 3px 2px rgba(0,0,0,.22));}}
[data-fl-map-scenery]{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;border-radius:inherit;}
[data-fl-scenery]{position:absolute;display:block;}
[data-fl-scenery='hill-a']{left:-5%;top:32%;width:28%;height:43%;border-radius:45% 55% 58% 42%;transform:rotate(-9deg);background:linear-gradient(145deg,rgba(153,199,132,.22),rgba(111,171,133,.12));border:1px solid rgba(105,159,117,.10);}
[data-fl-scenery='hill-b']{right:-6%;top:-8%;width:34%;height:45%;border-radius:40% 60% 47% 53%;transform:rotate(12deg);background:linear-gradient(145deg,rgba(166,207,139,.17),rgba(109,170,143,.10));border:1px solid rgba(105,159,117,.09);}
[data-fl-scenery='pond']{right:6%;bottom:5%;width:19%;height:21%;border-radius:58% 42% 54% 46% / 47% 55% 45% 53%;transform:rotate(-6deg);background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.50),transparent 18%),linear-gradient(145deg,rgba(140,209,210,.55),rgba(86,169,184,.38));border:3px solid rgba(255,255,255,.42);box-shadow:0 0 0 1px rgba(69,139,151,.16),inset 0 0 18px rgba(255,255,255,.28);}
[data-fl-scenery='plaza']{left:37%;top:42%;width:20%;height:23%;border-radius:50%;transform:rotate(5deg);background:repeating-linear-gradient(45deg,rgba(255,255,255,.20) 0 7px,rgba(187,160,115,.08) 7px 14px),rgba(238,224,188,.40);border:1px solid rgba(169,145,103,.12);}
[data-fl-scenery='trees-a']{left:3%;top:38%;font-size:18px;letter-spacing:-7px;filter:saturate(.82) drop-shadow(0 3px 2px rgba(45,87,62,.14));transform:rotate(-4deg);}
[data-fl-scenery='trees-b']{right:2%;top:36%;font-size:16px;letter-spacing:-6px;filter:saturate(.82) drop-shadow(0 3px 2px rgba(45,87,62,.14));transform:rotate(5deg);}
[data-fl-scenery='flowers']{left:26%;bottom:5%;font-size:12px;letter-spacing:9px;opacity:.72;}
@media(prefers-color-scheme:dark){[data-fl-scenery='hill-a'],[data-fl-scenery='hill-b']{opacity:.55;}[data-fl-scenery='pond']{background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.14),transparent 18%),linear-gradient(145deg,rgba(71,145,151,.46),rgba(46,104,126,.42));border-color:rgba(170,218,212,.14);}[data-fl-scenery='plaza']{opacity:.46;}[data-fl-scenery='trees-a'],[data-fl-scenery='trees-b']{filter:saturate(.64) brightness(.76) drop-shadow(0 3px 2px rgba(0,0,0,.24));}}
[data-fl-map-badge]{position:absolute;left:14px;top:13px;z-index:6;display:flex;align-items:center;gap:7px;padding:5px 10px 5px 7px;border:1px solid rgba(95,132,112,.18);border-radius:999px;background:rgba(255,255,255,.72);box-shadow:0 5px 15px rgba(45,83,66,.07);backdrop-filter:blur(8px);color:#3f6655;font-size:10px;letter-spacing:.03em;}
[data-fl-map-badge]::before{content:'🐳';display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:rgba(93,172,174,.14);font-size:13px;}
@media(prefers-color-scheme:dark){[data-fl-map-badge]{background:rgba(25,43,38,.70);border-color:rgba(151,199,178,.14);color:#b9d7c9;}}
[data-fl-map-attribution]{position:absolute;right:12px;bottom:9px;z-index:6;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.70);color:#4c675b;font-size:8px;line-height:1.3;text-decoration:none;backdrop-filter:blur(5px);}
@media(prefers-color-scheme:dark){[data-fl-map-attribution]{background:rgba(14,28,24,.66);color:#a8c7b9;}}
[data-fl-map-lines]{position:absolute;inset:0;z-index:3;width:100%;height:100%;overflow:visible;pointer-events:none;}
[data-fl-road]{opacity:.58;transition:opacity .2s ease;}
[data-fl-road-base]{fill:none;stroke:rgba(255,252,233,.78);stroke-width:4.2;stroke-linecap:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 1px 1px rgba(76,112,91,.12));}
[data-fl-road-mark]{fill:none;stroke:rgba(104,143,118,.32);stroke-width:1;stroke-linecap:round;stroke-dasharray:4 8;vector-effect:non-scaling-stroke;}
[data-fl-road][data-fl-road-active]{opacity:1;}
[data-fl-road][data-fl-road-active] [data-fl-road-base]{stroke:rgba(209,250,238,.96);filter:drop-shadow(0 0 4px rgba(25,153,145,.48));}
[data-fl-road][data-fl-road-active] [data-fl-road-mark]{stroke:#199b92;stroke-width:1.8;stroke-dasharray:4 5;animation:fl-road-flow .8s linear infinite;}
@keyframes fl-road-flow{to{stroke-dashoffset:-9;}}
@media(prefers-color-scheme:dark){[data-fl-road-base]{stroke:rgba(213,221,190,.30);filter:drop-shadow(0 1px 1px rgba(0,0,0,.22));}[data-fl-road-mark]{stroke:rgba(171,196,166,.34);}[data-fl-road][data-fl-road-active] [data-fl-road-base]{stroke:rgba(80,174,163,.42);}}
[data-fl-place]{--fl-place-color:#6eaa8a;--fl-place-soft:rgba(110,170,138,.30);position:absolute;z-index:5;transform:translate(-50%,-50%);display:grid;justify-items:center;min-width:28px;text-align:center;filter:drop-shadow(0 4px 5px rgba(42,77,63,.12));}
[data-fl-place][data-place='dorm']{--fl-place-color:#7f8fbd;--fl-place-soft:rgba(108,124,180,.30);}[data-fl-place][data-place='classroom']{--fl-place-color:#c98955;--fl-place-soft:rgba(205,137,77,.28);}[data-fl-place][data-place='library']{--fl-place-color:#6987b6;--fl-place-soft:rgba(92,120,169,.28);}[data-fl-place][data-place='canteen']{--fl-place-color:#cf775c;--fl-place-soft:rgba(211,113,79,.28);}[data-fl-place][data-place='shop']{--fl-place-color:#59a092;--fl-place-soft:rgba(75,150,137,.28);}[data-fl-place][data-place='outdoor']{--fl-place-color:#6c9c61;--fl-place-soft:rgba(98,155,84,.28);}[data-fl-place][data-place='cafe']{--fl-place-color:#a87955;--fl-place-soft:rgba(168,121,85,.28);}[data-fl-place][data-place='mall']{--fl-place-color:#9b6cad;--fl-place-soft:rgba(155,108,173,.28);}[data-fl-place][data-place='mcdonalds']{--fl-place-color:#d58a35;--fl-place-soft:rgba(213,138,53,.28);}
[data-fl-place-marker]{position:relative;width:11px;height:11px;border:2px solid rgba(255,255,255,.92);border-radius:50%;background:var(--fl-place-color);box-shadow:0 0 0 2px var(--fl-place-soft),0 2px 5px rgba(36,66,55,.20);transition:transform .22s ease,filter .22s ease;}
[data-fl-place-name]{max-width:112px;margin-top:4px;padding:2px 6px;border:1px solid rgba(78,111,97,.13);border-radius:999px;background:rgba(255,255,255,.76);box-shadow:0 2px 6px rgba(47,81,66,.06);backdrop-filter:blur(6px);color:#36584a;font-size:9px;font-weight:650;line-height:1.2;white-space:nowrap;}
[data-fl-place][data-fl-active] [data-fl-place-marker]{transform:scale(1.45);filter:drop-shadow(0 0 7px var(--fl-place-soft));}
[data-fl-place][data-fl-active] [data-fl-place-name]{border-color:var(--fl-place-color);box-shadow:0 0 0 3px var(--fl-place-soft),0 4px 12px rgba(47,81,66,.10);}
@media(prefers-color-scheme:dark){[data-fl-place-marker]{border-color:rgba(226,239,231,.72);filter:brightness(.92) saturate(.92);}[data-fl-place-name]{background:rgba(24,41,36,.78);border-color:rgba(173,205,188,.14);color:#d2e4da;}}
[data-fl-avatar]{position:absolute;z-index:8;transform:translate(-50%,calc(-100% - 48px));transition:left 1.2s linear,top 1.2s linear;filter:drop-shadow(0 7px 5px rgba(25,52,58,.23));}
[data-fl-avatar-motion]{position:relative;width:80px;height:80px;transform-origin:50% 100%;}
[data-fl-avatar-sprite]{width:80px;height:80px;background-color:transparent;background-image:var(--fl-avatar-image);background-size:320px 80px;background-position:0 0;background-repeat:no-repeat;background-clip:border-box;animation:fl-sprite-4 2.2s steps(1,end) infinite;}
[data-fl-avatar-motion][data-behavior='walk'] [data-fl-avatar-sprite]{animation-duration:.62s;}
[data-fl-avatar-motion][data-behavior='sleep'] [data-fl-avatar-sprite]{animation-duration:2.8s;}
[data-fl-avatar-motion][data-behavior='study'] [data-fl-avatar-sprite]{animation-duration:1.7s;}
[data-fl-avatar-motion][data-behavior='eat'] [data-fl-avatar-sprite]{animation-duration:1.25s;}
[data-fl-avatar-motion][data-behavior='phone'] [data-fl-avatar-sprite]{animation-duration:2s;}
[data-fl-avatar-motion][data-behavior='photo'] [data-fl-avatar-sprite]{animation-duration:1.6s;}
[data-fl-avatar-bubble]{position:absolute;right:-9px;top:-6px;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:Canvas;border:1px solid var(--fl-line);font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,.12);}
[data-fl-avatar-label]{position:absolute;left:50%;top:calc(100% + 4px);transform:translateX(-50%);white-space:nowrap;padding:2px 7px;border-radius:999px;background:rgba(16,66,68,.82);color:#fff;font-size:10px;box-shadow:0 3px 8px rgba(0,0,0,.14);}
[data-fl-world-cards]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
@keyframes fl-sprite-4{0%,24.99%{background-position-x:0}25%,49.99%{background-position-x:-80px}50%,74.99%{background-position-x:-160px}75%,100%{background-position-x:-240px}}
@media(prefers-reduced-motion:reduce){[data-fl-avatar]{transition:none!important;}[data-fl-avatar-sprite],[data-fl-road-mark]{animation:none!important;}[data-fl-avatar-sprite]{background-position-x:0!important;}}
@media(max-width:720px){[data-fl-stats]{grid-template-columns:repeat(2,minmax(0,1fr));}[data-fl-world-cards]{grid-template-columns:1fr;}[data-fl-map]{min-height:430px;}[data-fl-table]{display:block;overflow-x:auto;}[data-fl-tl-time]{flex-basis:78px;}[data-fl-track],[data-fl-ticks]{flex-basis:48%;}}
`

    // ── utilities ────────────────────────────────────────────────
    const clone = (x) => JSON.parse(JSON.stringify(x))
    const setPath = (obj, path, value) => {
      const out = clone(obj)
      let cur = out
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i]
        if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') cur[k] = typeof path[i + 1] === 'number' ? [] : {}
        cur = cur[k]
      }
      cur[path[path.length - 1]] = value
      return out
    }
    const getJson = async (url) => {
      const res = await fetch(url, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res.json()
    }
    const postJson = async (url, body) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res.json()
    }

    function Field({ value, onChange, width, placeholder, type, step }) {
      return h('input', {
        'data-fl-input': '', type: type || 'text', value: value ?? '', placeholder: placeholder || '',
        step, className: width || '', onChange: (e) => onChange(e.target.value),
      })
    }

    function Select({ value, onChange, options }) {
      return h('select', {
        'data-fl-input': '', value: value ?? options[0],
        onChange: (e) => onChange(e.target.value),
      }, options.map((o) => h('option', { key: o, value: o }, o)))
    }

    function Table({ columns, rows, render, add, addLabel, emptyLabel }) {
      return h('div', null,
        h('table', { 'data-fl-table': '' },
          h('thead', null, h('tr', null, columns.map((c) => h('th', { key: c.k }, c.t)))),
          h('tbody', null, rows.length
            ? rows.map((r, i) => h('tr', { key: i }, render(r, i)))
            : h('tr', null, h('td', { colSpan: columns.length }, h('div', { 'data-fl-empty': '' }, emptyLabel || '还没有内容'))))),
        h('div', { 'data-fl-row': '', style: { marginTop: '6px' } },
          h('button', { 'data-fl-btn': '', onClick: add }, addLabel || '添加一行')))
    }

    // ── timeline chart ──────────────────────────────────────────
    const clockOf = (minute) => {
      if (Math.round(minute) === 1440) return '24:00'
      const m = ((Math.round(minute) % 1440) + 1440) % 1440
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    }

    function TimelineChart({ timeline, currentMinute }) {
      if (!timeline || !timeline.length) return h('div', { 'data-fl-empty': '' }, '还没有今天的时间线')
      const rows = timeline.map((x) => ({ ...x, start: Math.max(0, x.start), end: Math.min(1440, x.end) })).filter((x) => x.end > x.start)
      const active = rows.find((x) => currentMinute >= x.start && currentMinute < x.end)
      return h('div', { 'data-fl-tl': '' },
        h('div', { 'data-fl-tl-row': '' },
          h('span', { 'data-fl-tl-time': '' }, ''),
          h('div', { 'data-fl-ticks': '' },
            [0, 6, 12, 18, 24].map((hh) => h('span', { key: hh, style: { left: (hh / 24 * 100) + '%' } }, hh + ':00')),
            h('span', { 'data-fl-now-mark': '', style: { left: (Math.max(0, Math.min(1440, currentMinute)) / 1440 * 100) + '%' } }, '此刻 ' + clockOf(currentMinute))),
          h('span', { 'data-fl-tl-what': '' }, '')),
        rows.map((x, i) => h('div', {
          key: i, 'data-fl-tl-row': '', 'data-fl-cur': x === active ? '' : undefined,
        },
          h('span', { 'data-fl-tl-time': '' }, `${clockOf(x.start)}–${clockOf(x.end)}`),
          h('div', { 'data-fl-track': '' },
            h('div', {
              'data-fl-seg': '', 'data-fl-src': x.source || 'plan',
              style: { left: (x.start / 1440 * 100) + '%', width: ((x.end - x.start) / 1440 * 100) + '%' },
              title: `${clockOf(x.start)}–${clockOf(x.end)} ${x.what}（${x.source || 'plan'}${x.outfit ? '，' + x.outfit : ''}）`,
            })),
          h('span', { 'data-fl-tl-what': '', title: x.what }, x.what,
            x.source && x.source !== 'plan' ? h('i', { 'data-fl-tl-src': '' }, x.source === 'travel' ? '通勤' : '调整') : null))),
        h('div', { 'data-fl-legend': '' },
          h('span', { 'data-fl-lg': '', 'data-fl-src': 'plan' }, '计划'),
          h('span', { 'data-fl-lg': '', 'data-fl-src': 'adjust' }, '调整（life_adjust）'),
          h('span', { 'data-fl-lg': '', 'data-fl-src': 'travel' }, '自动通勤')))
    }

    const behaviorMeta = {
      idle: ['✨', '发呆'], sleep: ['💤', '睡觉'], walk: ['👟', '移动中'],
      study: ['✏️', '学习 / 创作'], eat: ['🥢', '吃东西'], phone: ['📱', '玩手机'],
      photo: ['📷', '拍照'], bath: ['🫧', '洗漱'],
    }

    function WorldMap({ world, map }) {
      const nodes = (map && map.地点) || []
      const edges = (map && map.路径) || []
      const mapStyle = map && map.底图 === 'none' ? 'none' : 'xueyuan-road'
      const point = (world && world.position) || { x: 50, y: 50 }
      const behavior = (world && world.behavior) || 'idle'
      const spriteBehavior = behavior === 'bath' ? 'idle' : behaviorMeta[behavior] ? behavior : 'idle'
      const meta = behaviorMeta[behavior] || behaviorMeta.idle
      const active = world && world.moving && world.destination ? world.destination.id : world && world.location && world.location.id
      const routePairs = new Set(((world && world.route) || []).slice(1).map((id, i) => {
        const from = world.route[i]
        return [from, id].sort().join(':')
      }))
      return h('div', { 'data-fl-map': '', 'data-map-style': mapStyle },
        mapStyle === 'xueyuan-road' ? h('div', { 'data-fl-map-layers': '', 'aria-hidden': 'true' },
          h('img', { 'data-fl-map-layer': 'base', src: `${API}/map/xueyuan?layer=base&v=1.0.5`, alt: '' }),
          h('img', { 'data-fl-map-layer': 'anime', src: `${API}/map/xueyuan?layer=anime&v=1.0.5`, alt: '' }),
          h('img', { 'data-fl-map-layer': 'buildings', src: `${API}/map/xueyuan?layer=buildings&v=1.0.5`, alt: '' })) : null,
        h('div', { 'data-fl-map-scenery': '', 'aria-hidden': 'true' },
          h('i', { 'data-fl-scenery': 'hill-a' }),
          h('i', { 'data-fl-scenery': 'hill-b' }),
          h('i', { 'data-fl-scenery': 'pond' }),
          h('i', { 'data-fl-scenery': 'plaza' }),
          h('span', { 'data-fl-scenery': 'trees-a' }, '🌲🌳🌲'),
          h('span', { 'data-fl-scenery': 'trees-b' }, '🌳🌲🌳'),
          h('span', { 'data-fl-scenery': 'flowers' }, '✿ · ✿ · ✿')),
        h('div', { 'data-fl-map-badge': '' }, mapStyle === 'xueyuan-road' ? '矿大 · 学院路生活地图' : '鲸尾校园 · 今日地图'),
        h('svg', { 'data-fl-map-lines': '', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
          edges.map((edge, i) => {
            const a = nodes.find((x) => x.id === edge.from)
            const b = nodes.find((x) => x.id === edge.to)
            const pair = [edge.from, edge.to].sort().join(':')
            const points = a && b ? [a, ...(Array.isArray(edge.via) ? edge.via : []), b] : []
            const d = points.length ? `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}` : ''
            return a && b ? h('g', {
              key: i, 'data-fl-road': '', 'data-fl-road-active': routePairs.has(pair) ? '' : undefined,
            }, h('path', { 'data-fl-road-base': '', d }), h('path', { 'data-fl-road-mark': '', d })) : null
          })),
        nodes.map((node) => h('div', {
          key: node.id, 'data-fl-place': '', 'data-place': node.id, 'data-fl-active': active === node.id ? '' : undefined,
          style: { left: node.x + '%', top: node.y + '%' }, title: (node.关键词 || []).join('、'),
        }, h('span', { 'data-fl-place-marker': '' }),
        h('span', { 'data-fl-place-name': '' }, node.name))),
        world && world.enabled !== false ? h('div', {
          'data-fl-avatar': '', style: { left: point.x + '%', top: point.y + '%' },
        }, h('div', { 'data-fl-avatar-motion': '', 'data-behavior': behavior },
          h('div', {
            'data-fl-avatar-sprite': '', 'aria-hidden': 'true',
            style: { '--fl-avatar-image': `url(${API}/avatar/${spriteBehavior}?v=1.0.5)` },
          }),
          h('span', { 'data-fl-avatar-bubble': '', title: meta[1] }, meta[0]),
          h('span', { 'data-fl-avatar-label': '' }, world.moving && world.destination
            ? `去${world.destination.name} ${Math.round((world.progress || 0) * 100)}%`
            : (world.location && world.location.name) || '未知位置'))) : null,
        mapStyle === 'xueyuan-road' ? h('a', {
          'data-fl-map-attribution': '', href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noreferrer',
        }, '© OpenStreetMap contributors · modified') : null)
    }

    // ── panel ───────────────────────────────────────────────────
    function Panel() {
      const [config, setConfig] = useState(null)
      const [savedConfig, setSavedConfig] = useState(null)
      const [error, setError] = useState('')
      const [message, setMessage] = useState('')
      const [issues, setIssues] = useState([])
      const [tab, setTab] = useState('now')
      const [tableName, setTableName] = useState('日常')
      const [weekday, setWeekday] = useState('1')
      const [preview, setPreview] = useState(null)
      const [configPath, setConfigPath] = useState('')
      const [previewAt, setPreviewAt] = useState('')
      const [busy, setBusy] = useState(false)
      const [timeline, setTimeline] = useState([])
      const [currentMinute, setCurrentMinute] = useState(0)
      const [current, setCurrent] = useState(null)
      const [meta, setMeta] = useState(null)
      const [adjustments, setAdjustments] = useState([])
      const [world, setWorld] = useState(null)
      const [inferenceText, setInferenceText] = useState('蹲着看猫吃完半根火腿肠')
      const [inference, setInference] = useState(null)
      const dirty = Boolean(config && savedConfig && JSON.stringify(config) !== JSON.stringify(savedConfig))

      const load = async (preserveConfig = false) => {
        try {
          const data = await getJson(API + '/state')
          if (!preserveConfig) {
            setConfig(data.config)
            setSavedConfig(clone(data.config))
            setIssues([])
          }
          setPreview(data.preview)
          setConfigPath(data.configPath || '')
          setTimeline(data.timeline || [])
          setCurrentMinute(data.currentMinute || 0)
          setCurrent(data.current || null)
          setMeta(data.meta || null)
          setAdjustments(data.adjustments || [])
          setWorld(data.world || null)
          setError('')
        } catch (e) { setError('读不到配置：' + e.message) }
      }
      useEffect(() => { load() }, [])
      useEffect(() => {
        const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
      }, [dirty])

      const patch = (path, value) => setConfig((prev) => (prev ? setPath(prev, path, value) : prev))

      const save = async () => {
        if (!config) return
        setBusy(true); setMessage('保存中…')
        try {
          const data = await postJson(API + '/save', { config })
          setConfig(data.config); setPreview(data.preview)
          setTimeline(data.timeline || []); setCurrentMinute(data.currentMinute || 0)
          setSavedConfig(clone(data.config)); setCurrent(data.current || null); setMeta(data.meta || null)
          setAdjustments(data.adjustments || [])
          setWorld(data.world || null)
          setIssues(data.issues || [])
          setMessage((data.issues || []).length ? `已保存，有 ${(data.issues || []).length} 项配置提示` : '已保存，下一轮就用新配置')
        } catch (e) { setMessage('保存失败：' + e.message) }
        setBusy(false)
      }

      const reload = async () => {
        if (dirty && !window.confirm('还有未保存的修改，确定重新读取并放弃它们吗？')) return
        await load(); setMessage('已重新读取')
      }

      const regenerate = async () => {
        if (dirty) { setMessage('请先保存修改，再重新生成今日剧本'); return }
        if (!window.confirm('重新生成会替换今天已经固定下来的剧本，继续吗？')) return
        setBusy(true); setMessage('正在重新生成今日剧本…')
        try {
          const data = await postJson(API + '/regenerate', {})
          setPreview(data.preview); setTimeline(data.timeline || []); setCurrentMinute(data.currentMinute || 0)
          setCurrent(data.current || null); setMeta(data.meta || null)
          setAdjustments(data.adjustments || [])
          setWorld(data.world || null)
          setMessage('今日剧本已重新生成')
        } catch (e) { setMessage('重新生成失败：' + e.message) }
        setBusy(false)
      }

      const undoRegenerate = async () => {
        setBusy(true); setMessage('正在恢复上一次剧本…')
        try {
          const data = await postJson(API + '/undo-regenerate', {})
          setPreview(data.preview); setTimeline(data.timeline || []); setCurrentMinute(data.currentMinute || 0)
          setCurrent(data.current || null); setMeta(data.meta || null); setAdjustments(data.adjustments || [])
          setWorld(data.world || null)
          setMessage('已撤销上一次重新生成')
        } catch (e) { setMessage('撤销失败：' + e.message) }
        setBusy(false)
      }

      const deleteAdjustment = async (item) => {
        if (!window.confirm(`撤销 ${clockOf(item.start)}–${clockOf(item.end)} 的「${item.what}」吗？`)) return
        setBusy(true); setMessage('正在撤销临时调整…')
        try {
          const data = await postJson(API + '/adjustments/delete', { date: item.date, id: item.id, index: item.index })
          setPreview(data.preview); setTimeline(data.timeline || []); setCurrentMinute(data.currentMinute || 0)
          setCurrent(data.current || null); setMeta(data.meta || null); setAdjustments(data.adjustments || [])
          setWorld(data.world || null)
          setMessage('这条临时调整已撤销')
        } catch (e) { setMessage('撤销调整失败：' + e.message) }
        setBusy(false)
      }

      const previewOther = async () => {
        try {
          const ts = previewAt ? new Date(previewAt).getTime() : Date.now()
          const data = await getJson(API + '/preview?ts=' + ts)
          setPreview(data.preview); setTimeline(data.timeline || []); setCurrentMinute(data.currentMinute || 0)
          setCurrent(data.current || null); setMeta(data.meta || null)
          setAdjustments(data.adjustments || [])
          setWorld(data.world || null)
          setMessage('以下是在 ' + new Date(ts).toLocaleString() + ' 算出来的')
        } catch (e) { setMessage('预览失败：' + e.message) }
      }

      const testInference = async () => {
        const text = inferenceText.trim()
        if (!text) { setInference(null); return }
        try {
          const data = await getJson(API + '/infer?text=' + encodeURIComponent(text))
          setInference(data)
        } catch (e) { setMessage('识别测试失败：' + e.message) }
      }

      if (error) return h('div', { 'data-fl-wrap': '' }, h('div', { 'data-fl-note': '' }, error))
      if (!config) return h('div', { 'data-fl-wrap': '' }, h('div', { 'data-fl-note': '' }, '读取中…'))

      const previewBlock = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-h': '' }, '这会儿注入给她的'),
        h('div', { 'data-fl-prev': '' }, (preview && preview.text) || '（当前没有注入）'),
        h('div', { 'data-fl-why': '' }, ((preview && preview.evidence) || []).map((x, i) => h('span', { key: i, 'data-fl-chip': '' }, x))),
        h('div', { 'data-fl-row': '' },
          h('span', { 'data-fl-note': '' }, '想看别的日子：'),
          h('input', { 'data-fl-input': '', type: 'datetime-local', value: previewAt, onChange: (e) => setPreviewAt(e.target.value) }),
          h('button', { 'data-fl-btn': '', onClick: previewOther }, '预览这个时间'),
          h('button', { 'data-fl-btn': '', onClick: async () => { setPreviewAt(''); await load(true); setMessage('回到此刻') } }, '回到此刻')),
        h('div', { 'data-fl-note': '' }, '时序图里红线是此刻；灰色的段是按计划走，橙色的段是你用 life_adjust 改过的。'))

      const nowPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-h': '' }, '今天的时序'),
        h(TimelineChart, { timeline, currentMinute }),
        h('div', { 'data-fl-h': '' }, '临时调整记录'),
        adjustments.length ? h('table', { 'data-fl-table': '' },
          h('thead', null, h('tr', null,
            h('th', null, '时间'), h('th', null, '调整为'), h('th', null, '手机 / 穿着'), h('th', null, ''))),
          h('tbody', null, adjustments.map((item) => h('tr', { key: item.id || item.index },
            h('td', null, `${clockOf(item.start)}–${clockOf(item.end)}`),
            h('td', null, item.what),
            h('td', null, [item.phone, item.outfit].filter(Boolean).join(' / ') || '—'),
            h('td', null, h('button', { 'data-fl-del': '', disabled: busy, onClick: () => deleteAdjustment(item) }, '撤销'))))))
          : h('div', { 'data-fl-empty': '' }, '今天还没有用 life_adjust 改过安排'),
        previewBlock,
        h('div', { 'data-fl-sec': '' },
          h('div', { 'data-fl-h': '' }, '总开关与时间'),
          h('div', { 'data-fl-row': '' },
            h('label', { 'data-fl-row': '' },
              h('input', { type: 'checkbox', checked: config.总开关 !== false, onChange: (e) => patch(['总开关'], e.target.checked) }),
              h('span', null, '启用生活线（关掉就完全不注入）'))),
          h('div', { 'data-fl-row': '' },
            h('span', { 'data-fl-note': '' }, '时区'),
            h(Field, { value: config.时区, width: 'data-fl-narrow', onChange: (v) => patch(['时区'], v) })),
          h('div', { 'data-fl-row': '' },
            h('span', { 'data-fl-note': '' }, '模型硬超时（秒）'),
            h(Field, { value: config.模型超时秒, type: 'number', width: 'data-fl-num', onChange: (v) => patch(['模型超时秒'], Number(v) || 60) }),
            h('span', { 'data-fl-note': '' }, '剧本与调整保留（天）'),
            h(Field, { value: config.历史保留天数, type: 'number', width: 'data-fl-num', onChange: (v) => patch(['历史保留天数'], Number(v) || 180) })),
          h('label', { 'data-fl-sec': '' },
            h('span', { 'data-fl-note': '' }, '只在这些工作区注入（每行一个目录；留空 = 所有顶层会话）'),
            h('textarea', {
              'data-fl-input': '', rows: 3,
              value: (config.工作区 || []).join('\n'),
              placeholder: '/home/ubuntu/dsh-agentchat',
              onChange: (e) => patch(['工作区'], e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)),
              style: { width: '100%', resize: 'vertical', fontFamily: 'ui-monospace, monospace' },
            })),
          h('div', { 'data-fl-note': '' }, '配置文件：' + (configPath || '（未知）')),
          h('div', { 'data-fl-note': '' }, '改完点上面的「保存」。')))

      const mapCfg = config.地图 || { 启用: true, 自动通勤: true, 地点: [], 路径: [] }
      const placeRows = (mapCfg.地点 || []).map((node, i) => h('tr', { key: node.id || i },
        h('td', null, h(Field, { value: node.name, width: 'data-fl-narrow', onChange: (v) => patch(['地图', '地点', i, 'name'], v) })),
        h('td', null, h(Field, { value: node.x, type: 'number', width: 'data-fl-num', onChange: (v) => patch(['地图', '地点', i, 'x'], Number(v)) })),
        h('td', null, h(Field, { value: node.y, type: 'number', width: 'data-fl-num', onChange: (v) => patch(['地图', '地点', i, 'y'], Number(v)) })),
        h('td', null, h(Field, {
          value: (node.关键词 || []).join('、'), width: 'data-fl-wide',
          onChange: (v) => patch(['地图', '地点', i, '关键词'], v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean)),
        }))))
      const routeRows = (mapCfg.路径 || []).map((edge, i) => {
        const from = (mapCfg.地点 || []).find((x) => x.id === edge.from)
        const to = (mapCfg.地点 || []).find((x) => x.id === edge.to)
        return h('tr', { key: `${edge.from}-${edge.to}-${i}` },
          h('td', null, (from && from.name) || edge.from),
          h('td', null, (to && to.name) || edge.to),
          h('td', null, h(Field, { value: edge.minutes, type: 'number', width: 'data-fl-num', onChange: (v) => patch(['地图', '路径', i, 'minutes'], Number(v)) })))
      })
      const mapPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '地图不是另一套状态：它直接消费今天的真实时间线。相邻活动发生在不同地点时，会在前一段末尾自动留出通勤时间。'),
        h(WorldMap, { world, map: mapCfg }),
        h('div', { 'data-fl-world-cards': '' },
          h('div', { 'data-fl-stat': '' }, h('div', { 'data-fl-stat-k': '' }, '当前位置'), h('div', { 'data-fl-stat-v': '' }, (world && world.location && world.location.name) || '未知')),
          h('div', { 'data-fl-stat': '' }, h('div', { 'data-fl-stat-k': '' }, '行为'), h('div', { 'data-fl-stat-v': '' }, (behaviorMeta[(world && world.behavior) || 'idle'] || behaviorMeta.idle)[1])),
          h('div', { 'data-fl-stat': '' }, h('div', { 'data-fl-stat-k': '' }, '移动'), h('div', { 'data-fl-stat-v': '' }, world && world.moving && world.destination ? `去${world.destination.name} · ${Math.round((world.progress || 0) * 100)}%` : '停留中'))),
        h('div', { 'data-fl-h': '' }, '识别测试'),
        h('div', { 'data-fl-note': '' }, '输入一条剧本短句，立即检查它会被识别成什么地点和行为。'),
        h('div', { 'data-fl-row': '' },
          h(Field, { value: inferenceText, width: 'data-fl-wide', onChange: setInferenceText }),
          h('button', { 'data-fl-btn': '', onClick: testInference }, '测试')),
        inference ? h('div', { 'data-fl-why': '' },
          h('span', { 'data-fl-chip': '' }, `地点：${(inference.location && inference.location.name) || '未知'}`),
          h('span', { 'data-fl-chip': '' }, `行为：${inference.behaviorLabel || inference.behavior}`)) : null,
        h('div', { 'data-fl-h': '' }, '地图规则'),
        h('div', { 'data-fl-row': '' },
          h('label', { 'data-fl-row': '' },
            h('input', { type: 'checkbox', checked: mapCfg.启用 !== false, onChange: (e) => patch(['地图', '启用'], e.target.checked) }),
            h('span', null, '启用空间状态')),
          h('label', { 'data-fl-row': '' },
            h('input', { type: 'checkbox', checked: mapCfg.自动通勤 !== false, onChange: (e) => patch(['地图', '自动通勤'], e.target.checked) }),
            h('span', null, '跨地点时自动插入通勤'))),
        h('div', { 'data-fl-h': '' }, '地点与坐标'),
        h('div', { 'data-fl-note': '' }, '关键词用于从剧本短句判断地点；坐标是地图里的百分比位置。'),
        h('table', { 'data-fl-table': '' },
          h('thead', null, h('tr', null,
            h('th', null, '地点'), h('th', null, 'X'), h('th', null, 'Y'), h('th', null, '识别关键词'))),
          h('tbody', null, placeRows)),
        h('div', { 'data-fl-h': '' }, '路径耗时'),
        h('table', { 'data-fl-table': '' },
          h('thead', null, h('tr', null, h('th', null, '从'), h('th', null, '到'), h('th', null, '分钟'))),
          h('tbody', null, routeRows)))

      const calendarTable = (key, label, withRoutine) => h('div', { 'data-fl-sec': '', key },
        h('div', { 'data-fl-h': '' }, label),
        h(Table, {
          columns: withRoutine
            ? [{ k: 'name', t: '名字' }, { k: 'start', t: '从' }, { k: 'end', t: '到' }, { k: 'routine', t: '作息' }, { k: 'x', t: '' }]
            : [{ k: 'name', t: '名字' }, { k: 'start', t: '从' }, { k: 'end', t: '到' }, { k: 'x', t: '' }],
          rows: ((config.校历 || {})[key] || []),
          emptyLabel: '没有——这段时间按平常走',
          add: () => patch(['校历', key], [...((config.校历 || {})[key] || []), withRoutine ? { 名: '新的', 起: '2026-01-01', 止: '2026-01-07', 作息: '假期' } : { 名: '新的', 起: '2026-01-01', 止: '2026-01-07' }]),
          render: (r, i) => {
            const base = ['校历', key, i]
            const cells = [
              h('td', { key: 'a' }, h(Field, { value: r.名, width: 'data-fl-narrow', onChange: (v) => patch([...base, '名'], v) })),
              h('td', { key: 'b' }, h(Field, { value: r.起, type: 'date', width: 'data-fl-narrow', onChange: (v) => patch([...base, '起'], v) })),
              h('td', { key: 'c' }, h(Field, { value: r.止, type: 'date', width: 'data-fl-narrow', onChange: (v) => patch([...base, '止'], v) })),
            ]
            if (withRoutine) cells.push(h('td', { key: 'd' }, h(Select, { value: r.作息 || '假期', options: ['日常', '晚起', '假期', '备考'], onChange: (v) => patch([...base, '作息'], v) })))
            cells.push(h('td', { key: 'x' }, h('button', {
              'data-fl-del': '', onClick: () => {
                const next = ((config.校历 || {})[key] || []).filter((_, k) => k !== i)
                patch(['校历', key], next)
              },
            }, '删')))
            return cells
          },
        }))

      const festivalPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-h': '' }, '每年都过的节日'),
        h('div', { 'data-fl-note': '' }, '只填月和日，年年都算。节日当天会多一句「今天」的理由。'),
        h(Table, {
          columns: [{ k: 'name', t: '名字' }, { k: 'month', t: '月' }, { k: 'day', t: '日' }, { k: 'x', t: '' }],
          rows: (config.节日 || []).filter((x) => !x.起),
          emptyLabel: '还没有',
          add: () => patch(['节日'], [...(config.节日 || []), { 名: '新的节日', 月: 1, 日: 1 }]),
          render: (r) => {
            const i = (config.节日 || []).indexOf(r)
            const base = ['节日', i]
            return [
              h('td', { key: 'a' }, h(Field, { value: r.名, width: 'data-fl-narrow', onChange: (v) => patch([...base, '名'], v) })),
              h('td', { key: 'b' }, h(Field, { value: r.月, type: 'number', width: 'data-fl-num', onChange: (v) => patch([...base, '月'], Number(v) || 1) })),
              h('td', { key: 'c' }, h(Field, { value: r.日, type: 'number', width: 'data-fl-num', onChange: (v) => patch([...base, '日'], Number(v) || 1) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => patch(['节日'], (config.节日 || []).filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }),
        h('div', { 'data-fl-h': '' }, '只放那几天的（春节、国庆这种）'),
        h('div', { 'data-fl-note': '' }, '填起止日期，这几天当成放假，走假期作息、不上课。'),
        h(Table, {
          columns: [{ k: 'name', t: '名字' }, { k: 'start', t: '从' }, { k: 'end', t: '到' }, { k: 'x', t: '' }],
          rows: (config.节日 || []).filter((x) => x.起),
          emptyLabel: '还没有',
          add: () => patch(['节日'], [...(config.节日 || []), { 名: '新的假期', 起: '2027-01-01', 止: '2027-01-03' }]),
          render: (r) => {
            const i = (config.节日 || []).indexOf(r)
            const base = ['节日', i]
            return [
              h('td', { key: 'a' }, h(Field, { value: r.名, width: 'data-fl-narrow', onChange: (v) => patch([...base, '名'], v) })),
              h('td', { key: 'b' }, h(Field, { value: r.起, type: 'date', width: 'data-fl-narrow', onChange: (v) => patch([...base, '起'], v) })),
              h('td', { key: 'c' }, h(Field, { value: r.止, type: 'date', width: 'data-fl-narrow', onChange: (v) => patch([...base, '止'], v) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => patch(['节日'], (config.节日 || []).filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }))

      const yearPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '这是"年"这一层：先看今天落在哪段里 —— 特殊（考试周）优先，其次假期，其次是学期。落在假期就走假期作息、不上课。'),
        calendarTable('学期', '学期', false),
        calendarTable('假期', '假期', true),
        calendarTable('特殊', '特殊（考试周、军训这种）', true),
        festivalPage)

      const weekRows = ((config.课表 || {})[weekday] || [])
      const weekPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '只写在学期里有课的那几天。假期自动不上课。'),
        h('div', { 'data-fl-tabs': '' }, [1, 2, 3, 4, 5, 6, 7].map((d) => h('button', {
          key: d, 'data-fl-tab': '', 'data-fl-on': String(d) === weekday ? '' : undefined,
          onClick: () => setWeekday(String(d)),
        }, weekdayNames[d]))),
        h(Table, {
          columns: [{ k: 'a', t: '从' }, { k: 'b', t: '到' }, { k: 'c', t: '在干什么' }, { k: 'd', t: '手机' }, { k: 'x', t: '' }],
          rows: weekRows,
          emptyLabel: '这天没课',
          add: () => patch(['课表', weekday], [...weekRows, ['08:00', '11:30', '上课', '静音']]),
          render: (r, i) => {
            const base = ['课表', weekday, i]
            return [
              h('td', { key: 'a' }, h(Field, { value: r[0], type: 'time', width: 'data-fl-narrow', onChange: (v) => patch([...base, 0], v) })),
              h('td', { key: 'b' }, h(Field, { value: r[1], type: 'time', width: 'data-fl-narrow', onChange: (v) => patch([...base, 1], v) })),
              h('td', { key: 'c' }, h(Field, { value: r[2], width: 'data-fl-wide', onChange: (v) => patch([...base, 2], v) })),
              h('td', { key: 'd' }, h(Select, { value: r[3], options: phoneOptions, onChange: (v) => patch([...base, 3], v) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => patch(['课表', weekday], weekRows.filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }))

      const routineRows = config[tableName] || []
      const dayPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '一天切成几段。注意有一段要含「睡着」——早上几点起是从那段结尾算的。'),
        h('div', { 'data-fl-tabs': '' }, routineTables.map(([k, t]) => h('button', {
          key: k, 'data-fl-tab': '', 'data-fl-on': tableName === k ? '' : undefined, onClick: () => setTableName(k),
        }, t))),
        h(Table, {
          columns: [{ k: 'a', t: '从' }, { k: 'b', t: '到' }, { k: 'c', t: '在干什么' }, { k: 'd', t: '手机' }, { k: 'x', t: '' }],
          rows: routineRows,
          emptyLabel: '这张表还是空的',
          add: () => patch([tableName], [...routineRows, ['20:00', '22:00', '在干点什么', '在手']]),
          render: (r, i) => {
            const base = [tableName, i]
            return [
              h('td', { key: 'a' }, h(Field, { value: r[0], type: 'time', width: 'data-fl-narrow', onChange: (v) => patch([...base, 0], v) })),
              h('td', { key: 'b' }, h(Field, { value: r[1], type: 'time', width: 'data-fl-narrow', onChange: (v) => patch([...base, 1], v) })),
              h('td', { key: 'c' }, h(Field, { value: r[2], width: 'data-fl-wide', onChange: (v) => patch([...base, 2], v) })),
              h('td', { key: 'd' }, h(Select, { value: r[3], options: phoneOptions, onChange: (v) => patch([...base, 3], v) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => patch([tableName], routineRows.filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }),
        h('div', { 'data-fl-h': '' }, '能睡到中午的日子'),
        h('div', { 'data-fl-row': '' }, [1, 2, 3, 4, 5, 6, 7].map((d) => h('label', { key: d, 'data-fl-row': '' },
          h('input', {
            type: 'checkbox', checked: (config.晚起日 || []).includes(d),
            onChange: (e) => {
              const now = config.晚起日 || []
              patch(['晚起日'], e.target.checked ? [...now.filter((x) => x !== d), d].sort((a, b) => a - b) : now.filter((x) => x !== d))
            },
          }),
          h('span', null, weekdayNames[d])))))

      const period = config.经期 || {}
      const deviation = config.偏离 || {}
      const bodyPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-h': '' }, '经期'),
        h('div', { 'data-fl-note': '' }, '起始写最近一次的第一天；到了那几天，她会腰酸、想吃甜的、脾气差一点。'),
        h('div', { 'data-fl-row': '' },
          h('span', { 'data-fl-note': '' }, '起始'),
          h(Field, { value: period.起始, type: 'date', width: 'data-fl-narrow', onChange: (v) => patch(['经期', '起始'], v) }),
          h('span', { 'data-fl-note': '' }, '周期（天）'),
          h(Field, { value: period.周期, type: 'number', width: 'data-fl-num', onChange: (v) => patch(['经期', '周期'], Number(v) || 29) }),
          h('span', { 'data-fl-note': '' }, '持续（天）'),
          h(Field, { value: period.天数, type: 'number', width: 'data-fl-num', onChange: (v) => patch(['经期', '天数'], Number(v) || 5) })),
        h('div', { 'data-fl-h': '' }, '偶尔不按表走'),
        h('div', { 'data-fl-note': '' }, '0 到 1 之间的概率。0 = 永远按表走。躺平日和出门日互斥，翘课只影响下午。'),
        h('div', { 'data-fl-row': '' },
          h('span', { 'data-fl-note': '' }, '躺平'),
          h(Field, { value: deviation.躺平日, type: 'number', width: 'data-fl-num', step: '0.01', onChange: (v) => patch(['偏离', '躺平日'], Number(v) || 0) }),
          h('span', { 'data-fl-note': '' }, '出门'),
          h(Field, { value: deviation.出门日, type: 'number', width: 'data-fl-num', step: '0.01', onChange: (v) => patch(['偏离', '出门日'], Number(v) || 0) }),
          h('span', { 'data-fl-note': '' }, '翘下午的课'),
          h(Field, { value: deviation.翘下午课, type: 'number', width: 'data-fl-num', step: '0.01', onChange: (v) => patch(['偏离', '翘下午课'], Number(v) || 0) })),
        h('div', { 'data-fl-note': '' }, '注意：这些都是按日期抽的种子，同一天里不会变来变去 —— 变的是"今天是不是这种日子"。'))

      const eventsPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '一天里可能发生的小事。段决定它什么时候才可能出现（上午的小事不会凌晨就冒出来）；条件「早课」表示那天有早八才可能抽到。'),
        h(Table, {
          columns: [{ k: 'a', t: '段' }, { k: 'b', t: '内容' }, { k: 'c', t: '条件' }, { k: 'x', t: '' }],
          rows: config.事件池 || [],
          emptyLabel: '还没有',
          add: () => patch(['事件池'], [...(config.事件池 || []), ['下午', '新的一件小事']]),
          render: (r, i) => {
            const base = ['事件池', i]
            return [
              h('td', { key: 'a' }, h(Select, { value: r[0], options: sectionOptions, onChange: (v) => patch([...base, 0], v) })),
              h('td', { key: 'b' }, h(Field, { value: r[1], width: 'data-fl-wide', onChange: (v) => patch([...base, 1], v) })),
              h('td', { key: 'c' }, h(Select, { value: r[2] || '任意', options: ['任意', '早课'], onChange: (v) => patch([...base, 2], v === '任意' ? undefined : v) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => patch(['事件池'], (config.事件池 || []).filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }))

      const planMeta = (meta && meta.plan) || {}
      const detour = meta && meta.deviation && (meta.deviation.flat ? '躺平' : meta.deviation.outing ? '临时出门' : meta.deviation.skipAfternoon ? '翘下午课' : '')
      return h('div', { 'data-fl-wrap': '' },
        h('div', { 'data-fl-hero': '' },
          h('div', { 'data-fl-title': '' }, '鱼的生活'),
          h('div', { 'data-fl-subtitle': '' }, '让角色拥有会自然流动的一天；计划、临时调整和相机共用同一份真实状态。'),
          h('div', { 'data-fl-stats': '' },
            h('div', { 'data-fl-stat': '' }, h('div', { 'data-fl-stat-k': '' }, '此刻'), h('div', { 'data-fl-stat-v': '', title: current && current.what }, (current && current.what) || '等待状态')),
            h('div', { 'data-fl-stat': '' }, h('div', { 'data-fl-stat-k': '' }, '今天'), h('div', { 'data-fl-stat-v': '' }, (meta && meta.dayType && meta.dayType.name) || '平常')),
            h('div', { 'data-fl-stat': '' }, h('div', { 'data-fl-stat-k': '' }, '位置'), h('div', { 'data-fl-stat-v': '' }, (world && world.location && world.location.name) || '未知')),
            h('div', { 'data-fl-stat': '' }, h('div', { 'data-fl-stat-k': '' }, '今日剧本'), h('div', { 'data-fl-stat-v': '', title: planMeta.title || '' }, detour || (planMeta.source === 'llm' ? '模型生成' : planMeta.source === 'template' ? '本地模板' : '即时预览'))))),
        h('div', { 'data-fl-actions': '' },
          h('button', { 'data-fl-btn': '', 'data-fl-main': '', disabled: busy, onClick: save }, busy ? '保存中…' : '保存'),
          h('button', { 'data-fl-btn': '', disabled: busy, onClick: reload }, '重新读取'),
          tab === 'now' ? h('button', { 'data-fl-btn': '', disabled: busy, onClick: regenerate }, '重新生成今日剧本') : null,
          tab === 'now' ? h('button', {
            'data-fl-btn': '', disabled: busy || !(meta && meta.planHistoryCount), onClick: undoRegenerate,
            title: meta && meta.planHistoryCount ? `可恢复 ${meta.planHistoryCount} 个历史版本` : '暂无可恢复版本',
          }, '撤销上次重生成') : null,
          dirty ? h('span', { 'data-fl-dirty': '' }, '有未保存修改') : null,
          h('span', { 'data-fl-msg': '' }, message)),
        issues.length ? h('div', { 'data-fl-warn': '' },
          h('strong', null, '配置检查提示：'),
          ' ' + issues.slice(0, 4).join('；') + (issues.length > 4 ? `；另有 ${issues.length - 4} 项` : '')) : null,
        h('div', { 'data-fl-tabs': '' }, tabs.map(([k, t]) => h('button', {
          key: k, 'data-fl-tab': '', 'data-fl-on': tab === k ? '' : undefined, onClick: () => setTab(k),
        }, t))),
        tab === 'now' ? nowPage : null,
        tab === 'map' ? mapPage : null,
        tab === 'year' ? yearPage : null,
        tab === 'week' ? weekPage : null,
        tab === 'day' ? dayPage : null,
        tab === 'body' ? bodyPage : null,
        tab === 'events' ? eventsPage : null,
        tab === 'photo' ? h(ImagePanel.Panel) : null,
        h('div', { 'data-fl-msg': '' }, message))
    }


    // ── camera settings (merged from dsh-feiyu-image) ──
    // Its own scope so CSS / API names do not collide with the life panel.
    const ImagePanel = (() => {
      const API = '/dsh-feiyu-life/image'

      const CSS = `
  [data-fi-wrap]{--fi-accent:#167f78;display:flex;flex-direction:column;gap:14px;padding:4px 2px 24px;color-scheme:light dark;font-size:13px;}
  [data-fi-wrap] input,[data-fi-wrap] select,[data-fi-wrap] textarea{background:Canvas;color:CanvasText;border:1px solid rgba(127,127,127,.35);border-radius:7px;padding:6px 8px;font-size:13px;font-family:inherit;}
  [data-fi-wrap] input:focus,[data-fi-wrap] select:focus,[data-fi-wrap] textarea:focus{outline:2px solid rgba(22,127,120,.35);border-color:var(--fi-accent);outline-offset:1px;}
  [data-fi-wrap] textarea{width:100%;min-height:64px;resize:vertical;line-height:1.5;}
  [data-fi-wrap] input[type=number]{width:88px;}
  [data-fi-sec]{display:flex;flex-direction:column;gap:8px;}
  [data-fi-h]{font-size:13px;font-weight:600;opacity:.85;padding-top:10px;border-top:1px solid rgba(127,127,127,.18);}
  [data-fi-note]{font-size:12px;opacity:.62;line-height:1.55;}
  [data-fi-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  [data-fi-btn]{padding:5px 12px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);color:inherit;cursor:pointer;font-size:13px;}
  [data-fi-btn]:hover{background:rgba(127,127,127,.16);}
  [data-fi-btn][disabled]{opacity:.45;cursor:default;}
  [data-fi-btn][data-primary]{background:var(--fi-accent);border-color:var(--fi-accent);color:white;font-weight:650;}
  [data-fi-grid]{display:flex;gap:8px;flex-wrap:wrap;}
  [data-fi-grid] img{width:104px;height:104px;object-fit:cover;border-radius:8px;border:1px solid rgba(127,127,127,.3);}
  [data-fi-chip]{font-size:12px;padding:2px 8px;border-radius:999px;background:rgba(127,127,127,.14);}
  [data-fi-chip][data-ok]{background:rgba(60,180,110,.18);}
  [data-fi-chip][data-bad]{background:rgba(230,90,80,.18);}
  [data-fi-msg]{font-size:12px;min-height:16px;opacity:.75;}
  [data-fi-preview]{max-width:100%;border-radius:10px;border:1px solid rgba(127,127,127,.3);}
  `

      function Label(props) {
        return h('label', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          h('span', { style: { fontSize: 12, opacity: 0.7 } }, props.label),
          props.children)
      }

      function Panel() {
        const [status, setStatus] = useState(null)
        const [config, setConfig] = useState(null)
        const [message, setMessage] = useState('')
        const [busy, setBusy] = useState(false)
        const [draft, setDraft] = useState({ hint: '在宿舍书桌前托腮看镜头', outfit: '', expression: '', type: 'selfie' })
        const [result, setResult] = useState(null)
        const [models, setModels] = useState([])
        const [modelNote, setModelNote] = useState('')
        const [manual, setManual] = useState(false)

        const loadModels = async (force) => {
          setModelNote('拉取中…')
          try {
            const r = await fetch(`${API}/models${force ? '?f=1' : ''}`, { credentials: 'same-origin' })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '拉不到模型列表')
            setModels(d.models || [])
            setModelNote(d.modelError
              ? '没拉到，先用内置名单：' + String(d.modelError).slice(0, 80)
              : `${(d.models || []).length} 个可选${d.cached ? '（缓存 10 分钟）' : ''}`)
          } catch (e) {
            setModels([]); setModelNote('拉取失败：' + String((e && e.message) || e).slice(0, 100))
          }
        }

        const load = async () => {
          try {
            const r = await fetch(`${API}/state`, { credentials: 'same-origin' })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '读不到状态')
            setStatus(d); setConfig(d.config)
          } catch (e) { setMessage('读取失败：' + String(e.message || e)) }
        }
        useEffect(() => { load() }, [])
        useEffect(() => { loadModels() }, [])

        const edit = (k) => (e) => setConfig({ ...config, [k]: e && e.target ? e.target.value : e })
        const editNum = (k) => (e) => setConfig({ ...config, [k]: Number(e.target.value) })
        const editCheck = (k) => (e) => setConfig({ ...config, [k]: Boolean(e.target.checked) })

        const save = async () => {
          setBusy(true); setMessage('保存中…')
          try {
            const r = await fetch(`${API}/save`, {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ config }),
            })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '保存失败')
            setMessage('已保存，下一张就按新配置走'); setConfig(d.config)
            await load()
          } catch (e) { setMessage('保存失败：' + String(e.message || e)) } finally { setBusy(false) }
        }

        const shoot = async () => {
          setBusy(true); setMessage('正在拍，方舟大概 30 秒…'); setResult(null)
          try {
            const r = await fetch(`${API}/test`, {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(draft),
            })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '试拍失败')
            const name = String(d.image || '').split('/').pop()
            setResult({ url: `${API}/file?n=${encodeURIComponent(name)}`, prompt: d.prompt, bytes: d.bytes, check: d.check || null, notes: d.notes || [] })
            setMessage(d.check ? (d.check.pass ? '拍好了，自检过了' : '拍好了，但自检说不合格') : '拍好了')
            await load()
          } catch (e) { setMessage('试拍失败：' + String(e.message || e)) } finally { setBusy(false) }
        }

        if (!status || !config) return h('div', { 'data-fi-wrap': '' }, h('div', { 'data-fi-note': '' }, message || '读取中…'))

        const photos = status.photos || []

        return h('div', { 'data-fi-wrap': '' },
          h('div', { 'data-fi-row': '' },
            h('span', { 'data-fi-chip': '', 'data-ok': status.ark && status.ark.ok ? '' : undefined },
              status.ark && status.ark.ok ? '方舟 已连接' : '方舟 未配置'),
            h('span', { 'data-fi-chip': '', 'data-bad': status.hasRef ? undefined : '' },
              status.hasRef ? '参考图 有' : '参考图 缺'),
            h('span', { 'data-fi-chip': '' }, `今日 ${status.today}/${status.limit}`),
            h('span', { 'data-fi-chip': '' }, '后端 火山方舟')),

          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '模型'),
            h('div', { 'data-fi-row': '' },
              h(Label, { label: '模型（自动从后端拉）' },
                h('div', { 'data-fi-row': '' },
                  (manual || !models.length)
                    ? h('input', { value: config.模型 || '', onChange: edit('模型'), placeholder: '手填模型 id', style: { width: 300 } })
                    : h('select', {
                        value: models.includes(config.模型) ? config.模型 : '__keep',
                        style: { width: 300 },
                        onChange: (e) => {
                          const v = e.target.value
                          if (v === '__custom') { setManual(true); return }
                          if (v === '__keep') return
                          setConfig({ ...config, 模型: v })
                        },
                      },
                      ...(models.includes(config.模型) ? [] : [h('option', { key: '__keep', value: '__keep' }, `当前：${config.模型 || '(空)'}`)]),
                      ...models.map((id) => h('option', { key: id, value: id }, id)),
                      h('option', { key: '__custom', value: '__custom' }, '手填…')),
                  h('button', { 'data-fi-btn': '', onClick: () => loadModels(true) }, '刷新'),
                  manual ? h('button', { 'data-fi-btn': '', onClick: () => setManual(false) }, '改用列表') : null))),
            h('div', { 'data-fi-row': '' },
              h('label', { 'data-fi-row': '' },
                h('input', { type: 'checkbox', checked: Boolean(config.用参考图), onChange: editCheck('用参考图') }),
                h('span', {}, '用参考图锁角色（方舟专用）')),
              h(Label, { label: '参考图路径' },
                h('input', { value: config.参考图 || '', onChange: edit('参考图'), placeholder: '留空 = ~/.dsh/feiyu-life-image/角色设定/正面.jpg', style: { width: 420 } }))),
            h('div', { 'data-fi-note': '' },
              (modelNote ? `模型列表：${modelNote}。` : '') + '列表是实时问方舟要的，新出的模型会自动出现。')),

          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '形象与画风'),
            h(Label, { label: '固定特征（长相，每次一字不差带上）' }, h('textarea', { value: config.外观 || '', onChange: edit('外观') })),
            h(Label, { label: '默认服装（可被「穿着」参数覆盖）' }, h('textarea', { value: config.服装 || '', onChange: edit('服装') })),
            h(Label, { label: '画风' }, h('textarea', { value: config.风格 || '', onChange: edit('风格') })),
            h(Label, { label: '镜头（自拍时用）' }, h('textarea', { value: config.镜头 || '', onChange: edit('镜头') })),
            h(Label, { label: '默认表情' }, h('input', { value: config.表情 || '', onChange: edit('表情') })),
            h(Label, { label: '画面细节（越具体越像真的）' }, h('textarea', { value: config.细节 || '', onChange: edit('细节') })),
            h('div', { 'data-fi-row': '' },
              h(Label, { label: '画幅' },
                h('select', { value: config.画幅 || '竖幅', onChange: edit('画幅') },
                  h('option', { value: '竖幅' }, '竖幅 1440×1920（手机自拍）'),
                  h('option', { value: '方形' }, '方形 2048×2048'),
                  h('option', { value: '横幅' }, '横幅 1920×1440'))),
              h('div', { 'data-fi-note': '', style: { flex: 1 } }, '穿着默认取生活线里「此刻」那一段（不用填）；一张 60–100 秒。'))),

          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '节流与存储'),
            h('div', { 'data-fi-row': '' },
              h(Label, { label: '每天最多' }, h('input', { type: 'number', value: config.每日上限, onChange: editNum('每日上限') })),
              h(Label, { label: '两次最短间隔（秒）' }, h('input', { type: 'number', value: config.最短间隔秒, onChange: editNum('最短间隔秒') })),
              h(Label, { label: '存图目录（留空=默认）' }, h('input', { value: config.存图目录 || '', onChange: edit('存图目录'), style: { width: 320 } }))),
            h('div', { 'data-fi-row': '' },
              h(Label, { label: '提示词/自检超时（秒）' }, h('input', { type: 'number', min: 10, max: 300, value: config.模型超时秒, onChange: editNum('模型超时秒') })),
              h(Label, { label: '生图/下载超时（秒）' }, h('input', { type: 'number', min: 30, max: 600, value: config.生图超时秒, onChange: editNum('生图超时秒') })),
              h(Label, { label: '照片保留（天）' }, h('input', { type: 'number', min: 1, max: 3650, value: config.照片保留天数, onChange: editNum('照片保留天数') }))),
            h('div', { 'data-fi-row': '' },
              h('label', { 'data-fi-row': '' },
                h('input', { type: 'checkbox', checked: config.出图自检 !== false, onChange: editCheck('出图自检') }),
                h('span', {}, '出图后自检（看一眼角色/画风/画崩/文字水印）')),
              h(Label, { label: '不合格最多重拍' },
                h('input', { type: 'number', value: config.自检重拍 ?? 1, min: 0, max: 2, onChange: editNum('自检重拍') }))),
            h('div', { 'data-fi-note': '' }, '自检要花一次视觉调用，约 5–10 秒；重拍会多出一张图，也算今天的额度。')),

          h('div', { 'data-fi-row': '' },
            h('button', { 'data-fi-btn': '', 'data-primary': '', disabled: busy, onClick: save }, '保存'),
            h('button', { 'data-fi-btn': '', disabled: busy, onClick: load }, '重新读取'),
            h('span', { 'data-fi-msg': '' }, message)),

          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '试拍（不进对话，直接看效果）'),
            h('div', { 'data-fi-row': '' },
              h(Label, { label: '画面' },
                h('input', { value: draft.hint, onChange: (e) => setDraft({ ...draft, hint: e.target.value }), style: { width: 360 } })),
              h(Label, { label: '穿着（可空）' },
                h('input', { value: draft.outfit, onChange: (e) => setDraft({ ...draft, outfit: e.target.value }), placeholder: '睡衣 / 卫衣 / 浴巾' })),
              h(Label, { label: '表情（可空）' },
                h('input', { value: draft.expression || '', onChange: (e) => setDraft({ ...draft, expression: e.target.value }), placeholder: '偷笑 / 困 / 委屈' })),
              h(Label, { label: '类型' },
                h('select', { value: draft.type, onChange: (e) => setDraft({ ...draft, type: e.target.value }) },
                  h('option', { value: 'selfie' }, '自拍'),
                  h('option', { value: 'scene' }, '只拍场景'))),
              h('button', { 'data-fi-btn': '', 'data-primary': '', disabled: busy, onClick: shoot }, '拍一张（约 35 秒）')),
            h('div', { 'data-fi-note': '' }, '用的是保存后的配置；如果刚改过参数，先点保存。'),
            result && result.url ? h('div', { 'data-fi-sec': '' },
              h('img', { 'data-fi-preview': '', src: result.url, alt: '试拍结果' }),
              h('div', { 'data-fi-note': '' },
                (result.check
                  ? (result.check.pass ? '自检：合格 ' : '自检：不合格 ')
                    + (result.check.problems && result.check.problems.length ? '· ' + result.check.problems.join('；') + ' ' : '')
                    + (result.check.pass ? '' : '· 改法：' + (result.check.fix || '无'))
                  : '自检：没跑成'),
                ...(result.notes || []).map((x, i) => h('div', { key: 'n' + i, 'data-fi-note': '' }, '· ' + x)),
              ),
              h('div', { 'data-fi-note': '' }, `提示词：${result.prompt}`)) : null),

          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, `最近的照片（${photos.length}）`),
            h('div', { 'data-fi-grid': '' },
              ...photos.map((p) => h('img', {
                key: p.name,
                src: `${API}/file?n=${encodeURIComponent(p.name)}`,
                title: `${p.name} · ${Math.round(p.size / 1024)}KB`,
                alt: p.name,
              })))))
      }

      return { Panel, CSS }
    })()

    /** 左侧边栏入口图标（宿主传 size：展开 18 / 收起 16） */
    function FeiyuSidebarIcon({ size = 16 }) {
      return h('span', { style: { fontSize: size, lineHeight: 1 } }, '🐋')
    }

    /** 主页面容器：宿主 main 区域是固定高度，自己管滚动 */
    function FeiyuPage() {
      return h('div', {
        style: { height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px 48px', boxSizing: 'border-box' },
      }, h(Panel))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-feiyu-life')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'dsh-feiyu-life: settings css')

        const style2 = document.createElement('style')
        style2.setAttribute('data-plugin-css', 'dsh-feiyu-image')
        style2.textContent = ImagePanel.CSS
        document.head.appendChild(style2)
        ctx.effect(() => () => style2.remove(), 'dsh-feiyu-image: settings css')

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'feiyu-life', order: 56, label: '鱼的生活' },
          () => h(Panel),
        ))

        // 左侧边栏入口 + 独立主页面（跟 QQ 机器人插件同一套挂法）
        try {
          const inject = ctx.inject
          if (typeof inject === 'function') {
            inject.call(ctx, ['layout'], (pageCtx) => {
              const pageSlots = pageCtx.slots
              const layout = pageCtx.layout
              if (!pageSlots || !layout) return undefined
              const PAGE_ID = 'feiyu-life'
              const stopMain = pageSlots.inject('main', () => pageSlots.register(
                { name: 'main', key: PAGE_ID }, FeiyuPage,
              ))
              const stopSidebar = pageSlots.inject('sidebar.panellist', () => pageSlots.register({
                name: 'sidebar.panellist', id: PAGE_ID, order: 11, label: '鱼的生活',
              }, FeiyuSidebarIcon))
              return () => { stopSidebar(); stopMain() }
            })
          }
        } catch (e) { /* 老宿主没有侧边栏 slot 就只留在设置页 */ }

      },
    }
  },
})
