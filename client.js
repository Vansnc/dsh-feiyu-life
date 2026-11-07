/**
 * dsh-feiyu-life —— 浏览器半端（设置 → 鱼的生活线）
 *
 * 约定跟这一套插件一致：window.__ModuleLoader__.load({ id, factory })，React 从 require 拿。
 *
 * 这一页要干的事：
 *   · 「此刻」：现在注入给她的到底是哪两行，还有为什么这么算（依据）；
 *     想看别的日子，选个时间点预览，不用改系统时间。
 *   · 「年度」：学期 / 寒暑假 / 考试周 / 节日 —— 这几段决定走哪张作息表。
 *   · 「课表」「作息」：周一到周日哪些课、没课的日子几点起。
 *   · 「身体」：经期、熬夜、着凉、以及「偶尔不按表走」的概率。
 *   · 「事件」：一天里可能发生的小事，按上午/中午/下午/晚上分。
 *
 * 所有改动先落在本地 cfg 上，点「保存」才写盘；保存后宿主那边立刻用新配置算下一轮。
 */
window.__ModuleLoader__.load({
  id: 'dsh-feiyu-life',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect } = React

    const API = '/dsh-feiyu-life'
    const 手机选项 = ['在手', '静音', '在床头', '不在手边']
    const 段选项 = ['上午', '中午', '下午', '晚上']
    const 作息表们 = [['日常', '日常（有课的日子）'], ['晚起', '晚起（周四那种）'], ['假期', '假期'], ['备考', '备考（考试周）']]
    const 周日名 = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const 页签们 = [['now', '此刻'], ['year', '年度'], ['week', '课表'], ['day', '作息'], ['body', '身体'], ['events', '事件']]

    const CSS = `
[data-fl-wrap]{display:flex;flex-direction:column;gap:14px;padding:4px 2px 24px;color-scheme:light dark;font-size:13px;}
[data-fl-wrap] select{background:Canvas;color:CanvasText;}
[data-fl-wrap] select option{background:Canvas;color:CanvasText;}
[data-fl-sec]{display:flex;flex-direction:column;gap:8px;}
[data-fl-h]{font-size:13px;font-weight:600;opacity:.85;padding-top:8px;border-top:1px solid rgba(127,127,127,.18);}
[data-fl-note]{font-size:12px;opacity:.62;line-height:1.55;}
[data-fl-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
[data-fl-tabs]{display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid rgba(127,127,127,.2);}
[data-fl-tab]{padding:5px 12px;border-radius:7px;border:1px solid transparent;background:transparent;color:inherit;font-size:13px;cursor:pointer;opacity:.72;}
[data-fl-tab]:hover{background:rgba(127,127,127,.10);opacity:1;}
[data-fl-tab][data-fl-on]{background:rgba(127,127,127,.16);border-color:rgba(127,127,127,.28);opacity:1;font-weight:600;}
[data-fl-input]{padding:5px 8px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font-size:12.5px;}
[data-fl-input]:focus{outline:2px solid rgba(127,127,127,.35);outline-offset:1px;}
[data-fl-btn]{padding:6px 12px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font-size:13px;cursor:pointer;}
[data-fl-btn]:hover{background:rgba(127,127,127,.12);}
[data-fl-btn][disabled]{opacity:.5;cursor:default;}
[data-fl-btn][data-fl-main]{border-color:rgba(127,127,127,.55);font-weight:600;}
[data-fl-del]{padding:3px 8px;border-radius:6px;border:1px solid transparent;background:transparent;color:rgba(210,90,90,.9);cursor:pointer;font-size:12px;}
[data-fl-del]:hover{background:rgba(210,90,90,.12);}
[data-fl-msg]{font-size:12px;opacity:.8;min-height:16px;}
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
`

    // ── 小工具 ────────────────────────────────────────────────────
    const clone = (x) => JSON.parse(JSON.stringify(x))
    const 设 = (obj, 路径, 值) => {
      const out = clone(obj)
      let cur = out
      for (let i = 0; i < 路径.length - 1; i++) {
        const k = 路径[i]
        if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') cur[k] = typeof 路径[i + 1] === 'number' ? [] : {}
        cur = cur[k]
      }
      cur[路径[路径.length - 1]] = 值
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

    function 输入({ 值, 改, 宽, 提示, 类型, 步 }) {
      return h('input', {
        'data-fl-input': '', type: 类型 || 'text', value: 值 ?? '', placeholder: 提示 || '',
        step: 步, className: 宽 || '', onChange: (e) => 改(e.target.value),
      })
    }

    function 选择({ 值, 改, 选项 }) {
      return h('select', {
        'data-fl-input': '', value: 值 ?? 选项[0],
        onChange: (e) => 改(e.target.value),
      }, 选项.map((o) => h('option', { key: o, value: o }, o)))
    }

    function 表({ 列, 行, 渲染, 加, 加文案, 空文案 }) {
      return h('div', null,
        h('table', { 'data-fl-table': '' },
          h('thead', null, h('tr', null, 列.map((c) => h('th', { key: c.k }, c.t)))),
          h('tbody', null, 行.length
            ? 行.map((r, i) => h('tr', { key: i }, 渲染(r, i)))
            : h('tr', null, h('td', { colSpan: 列.length }, h('div', { 'data-fl-empty': '' }, 空文案 || '还没有内容'))))),
        h('div', { 'data-fl-row': '', style: { marginTop: '6px' } },
          h('button', { 'data-fl-btn': '', onClick: 加 }, 加文案 || '添加一行')))
    }

    // ── 面板 ──────────────────────────────────────────────────────
    function Panel() {
      const [cfg, setCfg] = useState(null)
      const [错, set错] = useState('')
      const [msg, setMsg] = useState('')
      const [页, set页] = useState('now')
      const [表名, set表名] = useState('日常')
      const [周日, set周日] = useState('1')
      const [预览, set预览] = useState(null)
      const [路径, set路径] = useState('')
      const [预览时刻, set预览时刻] = useState('')
      const [忙, set忙] = useState(false)

      const 载入 = async () => {
        try {
          const d = await getJson(API + '/state')
          setCfg(d.配置)
          set预览(d.预览)
          set路径(d.路径 || '')
          set错('')
        } catch (e) { set错('读不到配置：' + e.message) }
      }
      useEffect(() => { 载入() }, [])

      const 改 = (路径, 值) => setCfg((旧) => (旧 ? 设(旧, 路径, 值) : 旧))

      const 保存 = async () => {
        if (!cfg) return
        set忙(true); setMsg('保存中…')
        try {
          const d = await postJson(API + '/save', { 配置: cfg })
          setCfg(d.配置); set预览(d.预览)
          setMsg('已保存，下一轮就用新配置')
        } catch (e) { setMsg('保存失败：' + e.message) }
        set忙(false)
      }

      const 看别的时刻 = async () => {
        try {
          const ts = 预览时刻 ? new Date(预览时刻).getTime() : Date.now()
          const d = await getJson(API + '/preview?ts=' + ts)
          set预览(d.预览); setMsg('以下是在 ' + new Date(ts).toLocaleString() + ' 算出来的')
        } catch (e) { setMsg('预览失败：' + e.message) }
      }

      if (错) return h('div', { 'data-fl-wrap': '' }, h('div', { 'data-fl-note': '' }, 错))
      if (!cfg) return h('div', { 'data-fl-wrap': '' }, h('div', { 'data-fl-note': '' }, '读取中…'))

      const 预览块 = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-h': '' }, '这会儿注入给她的'),
        h('div', { 'data-fl-prev': '' }, (预览 && 预览.text) || '（当前没有注入）'),
        h('div', { 'data-fl-why': '' }, ((预览 && 预览.依据) || []).map((x, i) => h('span', { key: i, 'data-fl-chip': '' }, x))),
        h('div', { 'data-fl-row': '' },
          h('span', { 'data-fl-note': '' }, '想看别的日子：'),
          h('input', { 'data-fl-input': '', type: 'datetime-local', value: 预览时刻, onChange: (e) => set预览时刻(e.target.value) }),
          h('button', { 'data-fl-btn': '', onClick: 看别的时刻 }, '预览这个时间'),
          h('button', { 'data-fl-btn': '', onClick: async () => { set预览时刻(''); await 载入(); setMsg('回到此刻') } }, '回到此刻')),
        h('div', { 'data-fl-note': '' }, '依据里的「作息表」就是下面「作息」那一页选中的那张；「课表」只在学期里有课的日子生效。'))

      // 此刻
      const 此刻页 = h('div', { 'data-fl-sec': '' }, 预览块,
        h('div', { 'data-fl-sec': '' },
          h('div', { 'data-fl-h': '' }, '总开关与时间'),
          h('div', { 'data-fl-row': '' },
            h('label', { 'data-fl-row': '' },
              h('input', { type: 'checkbox', checked: cfg.总开关 !== false, onChange: (e) => 改(['总开关'], e.target.checked) }),
              h('span', null, '启用生活线（关掉就完全不注入）')),
          h('div', { 'data-fl-row': '' },
            h('span', { 'data-fl-note': '' }, '时区'),
            h(输入, { 值: cfg.时区, 宽: 'data-fl-narrow', 改: (v) => 改(['时区'], v) })),
          h('div', { 'data-fl-note': '' }, '配置文件：' + (路径 || '（未知）')),
          h('div', { 'data-fl-note': '' }, '改完点上面的「保存」。'))))

      // 年度
      const 校历表 = (键, 名, 带作息) => h('div', { 'data-fl-sec': '', key: 键 },
        h('div', { 'data-fl-h': '' }, 名),
        h(表, {
          列: 带作息 ? [{ k: '名', t: '名字' }, { k: '起', t: '从' }, { k: '止', t: '到' }, { k: '作', t: '作息' }, { k: 'x', t: '' }]
            : [{ k: '名', t: '名字' }, { k: '起', t: '从' }, { k: '止', t: '到' }, { k: 'x', t: '' }],
          行: ((cfg.校历 || {})[键] || []),
          空文案: '没有——这段时间按平常走',
          加: () => 改(['校历', 键], [...((cfg.校历 || {})[键] || []), 带作息 ? { 名: '新的', 起: '2026-01-01', 止: '2026-01-07', 作息: '假期' } : { 名: '新的', 起: '2026-01-01', 止: '2026-01-07' }]),
          渲染: (r, i) => {
            const 底 = ['校历', 键, i]
            const 列们 = [
              h('td', { key: 'a' }, h(输入, { 值: r.名, 宽: 'data-fl-narrow', 改: (v) => 改([...底, '名'], v) })),
              h('td', { key: 'b' }, h(输入, { 值: r.起, 类型: 'date', 宽: 'data-fl-narrow', 改: (v) => 改([...底, '起'], v) })),
              h('td', { key: 'c' }, h(输入, { 值: r.止, 类型: 'date', 宽: 'data-fl-narrow', 改: (v) => 改([...底, '止'], v) })),
            ]
            if (带作息) 列们.push(h('td', { key: 'd' }, h(选择, { 值: r.作息 || '假期', 选项: ['日常', '晚起', '假期', '备考'], 改: (v) => 改([...底, '作息'], v) })))
            列们.push(h('td', { key: 'x' }, h('button', {
              'data-fl-del': '', onClick: () => {
                const 新 = ((cfg.校历 || {})[键] || []).filter((_, k) => k !== i)
                改(['校历', 键], 新)
              },
            }, '删')))
            return 列们
          },
        }))

      const 节日页 = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-h': '' }, '每年都过的节日'),
        h('div', { 'data-fl-note': '' }, '只填月和日，年年都算。节日当天会多一句「今天」的理由。'),
        h(表, {
          列: [{ k: '名', t: '名字' }, { k: '月', t: '月' }, { k: '日', t: '日' }, { k: 'x', t: '' }],
          行: (cfg.节日 || []).filter((x) => !x.起),
          空文案: '还没有',
          加: () => 改(['节日'], [...(cfg.节日 || []), { 名: '新的节日', 月: 1, 日: 1 }]),
          渲染: (r) => {
            const i = (cfg.节日 || []).indexOf(r)
            const 底 = ['节日', i]
            return [
              h('td', { key: 'a' }, h(输入, { 值: r.名, 宽: 'data-fl-narrow', 改: (v) => 改([...底, '名'], v) })),
              h('td', { key: 'b' }, h(输入, { 值: r.月, 类型: 'number', 宽: 'data-fl-num', 改: (v) => 改([...底, '月'], Number(v) || 1) })),
              h('td', { key: 'c' }, h(输入, { 值: r.日, 类型: 'number', 宽: 'data-fl-num', 改: (v) => 改([...底, '日'], Number(v) || 1) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => 改(['节日'], (cfg.节日 || []).filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }),
        h('div', { 'data-fl-h': '' }, '只放那几天的（春节、国庆这种）'),
        h('div', { 'data-fl-note': '' }, '填起止日期，这几天当成放假，走假期作息、不上课。'),
        h(表, {
          列: [{ k: '名', t: '名字' }, { k: '起', t: '从' }, { k: '止', t: '到' }, { k: 'x', t: '' }],
          行: (cfg.节日 || []).filter((x) => x.起),
          空文案: '还没有',
          加: () => 改(['节日'], [...(cfg.节日 || []), { 名: '新的假期', 起: '2027-01-01', 止: '2027-01-03' }]),
          渲染: (r) => {
            const i = (cfg.节日 || []).indexOf(r)
            const 底 = ['节日', i]
            return [
              h('td', { key: 'a' }, h(输入, { 值: r.名, 宽: 'data-fl-narrow', 改: (v) => 改([...底, '名'], v) })),
              h('td', { key: 'b' }, h(输入, { 值: r.起, 类型: 'date', 宽: 'data-fl-narrow', 改: (v) => 改([...底, '起'], v) })),
              h('td', { key: 'c' }, h(输入, { 值: r.止, 类型: 'date', 宽: 'data-fl-narrow', 改: (v) => 改([...底, '止'], v) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => 改(['节日'], (cfg.节日 || []).filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }))

      const 年度页 = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '这是"年"这一层：先看今天落在哪段里 —— 特殊（考试周）优先，其次假期，其次是学期。落在假期就走假期作息、不上课。'),
        校历表('学期', '学期', false),
        校历表('假期', '假期', true),
        校历表('特殊', '特殊（考试周、军训这种）', true),
        节日页)

      // 课表
      const 课表行 = ((cfg.课表 || {})[周日] || [])
      const 课表页 = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '只写在学期里有课的那几天。假期自动不上课。'),
        h('div', { 'data-fl-tabs': '' }, [1, 2, 3, 4, 5, 6, 7].map((d) => h('button', {
          key: d, 'data-fl-tab': '', 'data-fl-on': String(d) === 周日 ? '' : undefined,
          onClick: () => set周日(String(d)),
        }, 周日名[d]))),
        h(表, {
          列: [{ k: 'a', t: '从' }, { k: 'b', t: '到' }, { k: 'c', t: '在干什么' }, { k: 'd', t: '手机' }, { k: 'x', t: '' }],
          行: 课表行,
          空文案: '这天没课',
          加: () => 改(['课表', 周日], [...课表行, ['08:00', '11:30', '上课', '静音']]),
          渲染: (r, i) => {
            const 底 = ['课表', 周日, i]
            return [
              h('td', { key: 'a' }, h(输入, { 值: r[0], 类型: 'time', 宽: 'data-fl-narrow', 改: (v) => 改([...底, 0], v) })),
              h('td', { key: 'b' }, h(输入, { 值: r[1], 类型: 'time', 宽: 'data-fl-narrow', 改: (v) => 改([...底, 1], v) })),
              h('td', { key: 'c' }, h(输入, { 值: r[2], 宽: 'data-fl-wide', 改: (v) => 改([...底, 2], v) })),
              h('td', { key: 'd' }, h(选择, { 值: r[3], 选项: 手机选项, 改: (v) => 改([...底, 3], v) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => 改(['课表', 周日], 课表行.filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }))

      // 作息
      const 作息行 = cfg[表名] || []
      const 作息页 = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '一天切成几段。注意有一段要含「睡着」——早上几点起是从那段结尾算的。'),
        h('div', { 'data-fl-tabs': '' }, 作息表们.map(([k, t]) => h('button', {
          key: k, 'data-fl-tab': '', 'data-fl-on': 表名 === k ? '' : undefined, onClick: () => set表名(k),
        }, t))),
        h(表, {
          列: [{ k: 'a', t: '从' }, { k: 'b', t: '到' }, { k: 'c', t: '在干什么' }, { k: 'd', t: '手机' }, { k: 'x', t: '' }],
          行: 作息行,
          空文案: '这张表还是空的',
          加: () => 改([表名], [...作息行, ['20:00', '22:00', '在干点什么', '在手']]),
          渲染: (r, i) => {
            const 底 = [表名, i]
            return [
              h('td', { key: 'a' }, h(输入, { 值: r[0], 类型: 'time', 宽: 'data-fl-narrow', 改: (v) => 改([...底, 0], v) })),
              h('td', { key: 'b' }, h(输入, { 值: r[1], 类型: 'time', 宽: 'data-fl-narrow', 改: (v) => 改([...底, 1], v) })),
              h('td', { key: 'c' }, h(输入, { 值: r[2], 宽: 'data-fl-wide', 改: (v) => 改([...底, 2], v) })),
              h('td', { key: 'd' }, h(选择, { 值: r[3], 选项: 手机选项, 改: (v) => 改([...底, 3], v) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => 改([表名], 作息行.filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }),
        h('div', { 'data-fl-h': '' }, '能睡到中午的日子'),
        h('div', { 'data-fl-row': '' }, [1, 2, 3, 4, 5, 6, 7].map((d) => h('label', { key: d, 'data-fl-row': '' },
          h('input', {
            type: 'checkbox', checked: (cfg.晚起日 || []).includes(d),
            onChange: (e) => {
              const 现 = cfg.晚起日 || []
              改(['晚起日'], e.target.checked ? [...现.filter((x) => x !== d), d].sort((a, b) => a - b) : 现.filter((x) => x !== d))
            },
          }),
          h('span', null, 周日名[d])))))

      // 身体
      const 经 = cfg.经期 || {}
      const 偏 = cfg.偏离 || {}
      const 身体页 = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-h': '' }, '经期'),
        h('div', { 'data-fl-note': '' }, '起始写最近一次的第一天；到了那几天，她会腰酸、想吃甜的、脾气差一点。'),
        h('div', { 'data-fl-row': '' },
          h('span', { 'data-fl-note': '' }, '起始'),
          h(输入, { 值: 经.起始, 类型: 'date', 宽: 'data-fl-narrow', 改: (v) => 改(['经期', '起始'], v) }),
          h('span', { 'data-fl-note': '' }, '周期（天）'),
          h(输入, { 值: 经.周期, 类型: 'number', 宽: 'data-fl-num', 改: (v) => 改(['经期', '周期'], Number(v) || 29) }),
          h('span', { 'data-fl-note': '' }, '持续（天）'),
          h(输入, { 值: 经.天数, 类型: 'number', 宽: 'data-fl-num', 改: (v) => 改(['经期', '天数'], Number(v) || 5) })),
        h('div', { 'data-fl-h': '' }, '偶尔不按表走'),
        h('div', { 'data-fl-note': '' }, '0 到 1 之间的概率。0 = 永远按表走。躺平日和出门日互斥，翘课只影响下午。'),
        h('div', { 'data-fl-row': '' },
          h('span', { 'data-fl-note': '' }, '躺平'),
          h(输入, { 值: 偏.躺平日, 类型: 'number', 宽: 'data-fl-num', 步: '0.01', 改: (v) => 改(['偏离', '躺平日'], Number(v) || 0) }),
          h('span', { 'data-fl-note': '' }, '出门'),
          h(输入, { 值: 偏.出门日, 类型: 'number', 宽: 'data-fl-num', 步: '0.01', 改: (v) => 改(['偏离', '出门日'], Number(v) || 0) }),
          h('span', { 'data-fl-note': '' }, '翘下午的课'),
          h(输入, { 值: 偏.翘下午课, 类型: 'number', 宽: 'data-fl-num', 步: '0.01', 改: (v) => 改(['偏离', '翘下午课'], Number(v) || 0) })),
        h('div', { 'data-fl-note': '' }, '注意：这些都是按日期抽的种子，同一天里不会变来变去 —— 变的是"今天是不是这种日子"。'))

      // 事件
      const 事件页 = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-note': '' }, '一天里可能发生的小事。段决定它什么时候才可能出现（上午的小事不会凌晨就冒出来）；条件「早课」表示那天有早八才可能抽到。'),
        h(表, {
          列: [{ k: 'a', t: '段' }, { k: 'b', t: '内容' }, { k: 'c', t: '条件' }, { k: 'x', t: '' }],
          行: cfg.事件池 || [],
          空文案: '还没有',
          加: () => 改(['事件池'], [...(cfg.事件池 || []), ['下午', '新的一件小事']]),
          渲染: (r, i) => {
            const 底 = ['事件池', i]
            return [
              h('td', { key: 'a' }, h(选择, { 值: r[0], 选项: 段选项, 改: (v) => 改([...底, 0], v) })),
              h('td', { key: 'b' }, h(输入, { 值: r[1], 宽: 'data-fl-wide', 改: (v) => 改([...底, 1], v) })),
              h('td', { key: 'c' }, h(选择, { 值: r[2] || '任意', 选项: ['任意', '早课'], 改: (v) => 改([...底, 2], v === '任意' ? undefined : v) })),
              h('td', { key: 'x' }, h('button', { 'data-fl-del': '', onClick: () => 改(['事件池'], (cfg.事件池 || []).filter((_, k) => k !== i)) }, '删')),
            ]
          },
        }))

      return h('div', { 'data-fl-wrap': '' },
        h('div', { 'data-fl-row': '' },
          h('button', { 'data-fl-btn': '', 'data-fl-main': '', disabled: 忙, onClick: 保存 }, 忙 ? '保存中…' : '保存'),
          h('button', { 'data-fl-btn': '', onClick: 载入 }, '重新读取'),
          h('span', { 'data-fl-msg': '' }, msg)),
        h('div', { 'data-fl-tabs': '' }, 页签们.map(([k, t]) => h('button', {
          key: k, 'data-fl-tab': '', 'data-fl-on': 页 === k ? '' : undefined, onClick: () => set页(k),
        }, t))),
        页 === 'now' ? 此刻页 : null,
        页 === 'year' ? 年度页 : null,
        页 === 'week' ? 课表页 : null,
        页 === 'day' ? 作息页 : null,
        页 === 'body' ? 身体页 : null,
        页 === 'events' ? 事件页 : null,
        h('div', { 'data-fl-msg': '' }, msg))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-feiyu-life')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'dsh-feiyu-life: 设置页样式')

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'feiyu-life', order: 56, label: '鱼的生活线' },
          () => h(Panel),
        ))
      },
    }
  },
})
