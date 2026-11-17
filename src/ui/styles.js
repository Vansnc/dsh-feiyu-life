// Shared settings-page styles.
export const CSS = `
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
[data-fl-subtabs]{display:flex;gap:4px;flex-wrap:wrap;margin-top:-2px;}
[data-fl-subtab]{padding:4px 10px;border-radius:6px;border:1px solid transparent;background:transparent;color:inherit;font-size:12.5px;cursor:pointer;opacity:.68;}
[data-fl-subtab]:hover{background:rgba(127,127,127,.10);opacity:1;}
[data-fl-subtab][data-fl-on]{background:rgba(127,127,127,.13);border-color:rgba(127,127,127,.2);opacity:1;font-weight:600;}
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
[data-fl-cont-grid]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
[data-fl-cont-card]{padding:12px;border:1px solid var(--fl-line);border-radius:12px;background:rgba(127,127,127,.045);}
[data-fl-cont-card] strong{display:block;margin-bottom:4px;}
[data-fl-cont-meta]{font-size:11px;opacity:.58;line-height:1.5;}
[data-fl-meter]{height:7px;margin-top:7px;overflow:hidden;border-radius:999px;background:rgba(127,127,127,.14);}
[data-fl-meter]>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--fl-warm),var(--fl-accent));}
[data-fl-event][data-status='failed']{border-color:rgba(210,70,70,.28);}
[data-fl-event-type]{display:inline-flex;margin-left:6px;padding:1px 6px;border-radius:999px;background:var(--fl-accent-soft);color:var(--fl-accent);font-size:10px;}
[data-fl-due]{display:inline-flex;margin-top:5px;padding:2px 7px;border-radius:999px;background:rgba(217,119,50,.12);color:var(--fl-warm);font-size:10.5px;font-weight:650;}
[data-fl-due][data-state='overdue']{background:rgba(210,70,70,.13);color:#c94e4e;}
[data-fl-sync]{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid var(--fl-line);border-radius:11px;background:var(--fl-accent-soft);}
@media(max-width:720px){[data-fl-tabs]{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;}[data-fl-subtabs]{flex-wrap:nowrap;overflow-x:auto;}[data-fl-cont-grid]{grid-template-columns:1fr;}}
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
@media(prefers-color-scheme:dark){[data-fl-scenery='hill-a'],[data-fl-scenery='hill-b']{opacity:.55;}[data-fl-scenery='pond']{background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.14),transparent 18%),linear-gradient(145deg,rgba(71,145,151,.46),rgba(46,104,126,.42));border-color:rgba(170,218,212,.14);}[data-fl-scenery='plaza']{opacity:.46;}}
[data-fl-map-badge]{position:absolute;left:14px;top:13px;z-index:6;display:flex;align-items:center;gap:7px;padding:5px 10px 5px 7px;border:1px solid rgba(95,132,112,.18);border-radius:999px;background:rgba(255,255,255,.72);box-shadow:0 5px 15px rgba(45,83,66,.07);backdrop-filter:blur(8px);color:#3f6655;font-size:10px;letter-spacing:.03em;}
[data-fl-brand-mark]{display:block;flex:none;}
[data-fl-map-logo]{display:block;width:22px;height:22px;border-radius:50%;object-fit:contain;box-sizing:border-box;}
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
[data-fl-place]{--fl-place-color:#6eaa8a;--fl-place-soft:rgba(110,170,138,.30);position:absolute;z-index:5;transform:translate(-50%,-50%);width:34px;height:34px;color:var(--fl-place-color);text-align:center;filter:drop-shadow(0 3px 4px rgba(42,77,63,.16));}
[data-fl-place][data-place='dorm']{--fl-place-color:#667ab4;--fl-place-soft:rgba(108,124,180,.30);}[data-fl-place][data-place='classroom']{--fl-place-color:#b86f3e;--fl-place-soft:rgba(205,137,77,.28);}[data-fl-place][data-place='library']{--fl-place-color:#5274ad;--fl-place-soft:rgba(92,120,169,.28);}[data-fl-place][data-place='canteen']{--fl-place-color:#bd5f47;--fl-place-soft:rgba(211,113,79,.28);}[data-fl-place][data-place='shop']{--fl-place-color:#378c7c;--fl-place-soft:rgba(75,150,137,.28);}[data-fl-place][data-place='outdoor']{--fl-place-color:#518d47;--fl-place-soft:rgba(98,155,84,.28);}[data-fl-place][data-place='cafe']{--fl-place-color:#8e5f3e;--fl-place-soft:rgba(168,121,85,.28);}[data-fl-place][data-place='mall']{--fl-place-color:#88519b;--fl-place-soft:rgba(155,108,173,.28);}[data-fl-place][data-place='mcdonalds']{--fl-place-color:#d6232e;--fl-place-soft:rgba(214,35,46,.25);}
[data-fl-place-marker]{position:absolute;inset:0;display:block;color:var(--fl-place-color);transform-origin:50% 75%;transition:transform .22s ease,filter .22s ease;}
[data-fl-place-glyph]{display:block;width:34px;height:34px;overflow:visible;filter:drop-shadow(0 1px 0 rgba(255,255,255,.90)) drop-shadow(0 2px 2px rgba(35,63,54,.18));}
[data-fl-place-name]{position:absolute;left:50%;top:35px;transform:translateX(-50%);max-width:120px;color:#284d40;font-size:9px;font-weight:750;line-height:1.15;white-space:nowrap;text-shadow:-1px -1px 0 rgba(255,255,255,.96),1px -1px 0 rgba(255,255,255,.96),-1px 1px 0 rgba(255,255,255,.96),1px 1px 0 rgba(255,255,255,.96),0 2px 3px rgba(255,255,255,.92);}
[data-fl-place][data-place='classroom'] [data-fl-place-name]{left:4px;top:9px;transform:translateX(-100%);}
[data-fl-place][data-place='cafe'] [data-fl-place-name]{left:38px;top:9px;transform:none;}
[data-fl-place][data-place='mcdonalds'] [data-fl-place-name]{top:auto;bottom:35px;}
[data-fl-place][data-fl-active] [data-fl-place-marker]{transform:translateY(-2px) scale(1.16);filter:drop-shadow(0 0 7px var(--fl-place-soft));}
[data-fl-place][data-fl-active] [data-fl-place-name]{color:var(--fl-place-color);font-weight:850;}
@media(prefers-color-scheme:dark){[data-fl-place-glyph]{filter:drop-shadow(0 1px 0 rgba(230,242,234,.38)) drop-shadow(0 2px 3px rgba(0,0,0,.42));}[data-fl-place-name]{color:#d8e8df;text-shadow:-1px -1px 0 rgba(15,31,27,.95),1px -1px 0 rgba(15,31,27,.95),-1px 1px 0 rgba(15,31,27,.95),1px 1px 0 rgba(15,31,27,.95),0 2px 3px rgba(0,0,0,.85);}}
[data-fl-avatar]{position:absolute;z-index:8;transform:translate(-50%,calc(-100% - 48px));transition:left 1.2s linear,top 1.2s linear;filter:drop-shadow(0 7px 5px rgba(25,52,58,.23));}
[data-fl-avatar-motion]{position:relative;width:80px;height:80px;transform-origin:50% 100%;}
[data-fl-avatar-sprite]{width:80px;height:80px;background-color:transparent;background-image:var(--fl-avatar-image);background-size:320px 80px;background-position:0 0;background-repeat:no-repeat;background-clip:border-box;animation:fl-sprite-4 2.2s steps(1,end) infinite;}
[data-fl-avatar-motion][data-behavior='walk'] [data-fl-avatar-sprite]{animation-duration:.62s;}
[data-fl-avatar-motion][data-behavior='sleep'] [data-fl-avatar-sprite]{animation-duration:2.8s;}
[data-fl-avatar-motion][data-behavior='study'] [data-fl-avatar-sprite]{animation-duration:1.7s;}
[data-fl-avatar-motion][data-behavior='eat'] [data-fl-avatar-sprite]{animation-duration:1.25s;}
[data-fl-avatar-motion][data-behavior='phone'] [data-fl-avatar-sprite]{animation-duration:2s;}
[data-fl-avatar-motion][data-behavior='photo'] [data-fl-avatar-sprite]{animation-duration:1.6s;}
[data-fl-avatar-motion][data-behavior='bath'] [data-fl-avatar-sprite]{animation-duration:1.35s;}
[data-fl-avatar-bubble]{position:absolute;right:-9px;top:-6px;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:Canvas;border:1px solid var(--fl-line);color:var(--fl-accent);box-shadow:0 4px 12px rgba(0,0,0,.12);}
[data-fl-avatar-bubble] svg{display:block;width:17px;height:17px;}
[data-fl-avatar-label]{position:absolute;left:50%;top:calc(100% + 4px);transform:translateX(-50%);white-space:nowrap;padding:2px 7px;border-radius:999px;background:rgba(16,66,68,.82);color:#fff;font-size:10px;box-shadow:0 3px 8px rgba(0,0,0,.14);}
[data-fl-world-cards]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
[data-fl-replay-controls]{display:grid;grid-template-columns:auto minmax(180px,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--fl-line);border-radius:12px;background:rgba(127,127,127,.06);}
[data-fl-replay-controls] input[type='range']{width:100%;accent-color:var(--fl-accent);}
[data-fl-replay-time]{min-width:52px;text-align:center;font-size:15px;font-weight:750;font-variant-numeric:tabular-nums;color:var(--fl-accent);}
[data-fl-replay-empty]{padding:24px;text-align:center;border:1px dashed rgba(127,127,127,.28);border-radius:14px;font-size:12px;opacity:.65;}
[data-fl-backup-card]{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:14px;border:1px solid var(--fl-line);border-radius:12px;background:rgba(127,127,127,.045);}
[data-fl-backup-title]{font-size:13px;font-weight:700;margin-bottom:4px;}
[data-fl-backup-meta]{font-size:11.5px;opacity:.62;line-height:1.55;overflow-wrap:anywhere;}
@keyframes fl-sprite-4{0%,24.99%{background-position-x:0}25%,49.99%{background-position-x:-80px}50%,74.99%{background-position-x:-160px}75%,100%{background-position-x:-240px}}
@media(prefers-reduced-motion:reduce){[data-fl-avatar]{transition:none!important;}[data-fl-avatar-sprite],[data-fl-road-mark]{animation:none!important;}[data-fl-avatar-sprite]{background-position-x:0!important;}}
@media(max-width:720px){[data-fl-tabs]{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;}[data-fl-subtabs]{flex-wrap:nowrap;overflow-x:auto;}[data-fl-stats]{grid-template-columns:repeat(2,minmax(0,1fr));}[data-fl-world-cards]{grid-template-columns:1fr;}[data-fl-map]{min-height:430px;}[data-fl-table]{display:block;overflow-x:auto;}[data-fl-tl-time]{flex-basis:78px;}[data-fl-track],[data-fl-ticks]{flex-basis:48%;}[data-fl-replay-controls]{grid-template-columns:auto 1fr;}[data-fl-replay-time]{grid-column:1/-1;grid-row:1;}}
`
