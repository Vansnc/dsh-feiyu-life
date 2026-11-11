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
    const tabs = [['now', '此刻'], ['year', '年度'], ['week', '课表'], ['day', '作息'], ['body', '身体'], ['events', '事件'], ['photo', '照片']]

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
[data-fl-tl-what]{flex:1;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-fl-tl-src]{font-style:normal;font-size:10px;opacity:.75;margin-left:6px;padding:1px 6px;border-radius:999px;background:rgba(127,127,127,.14);}
[data-fl-tl-row][data-fl-cur] [data-fl-seg]{box-shadow:0 0 0 2px rgba(255,82,82,.75);}
[data-fl-tl-row][data-fl-cur] [data-fl-tl-what]{font-weight:600;}
[data-fl-legend]{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;opacity:.7;margin-top:6px;}
[data-fl-lg]{display:inline-flex;align-items:center;gap:4px;}
[data-fl-lg]::before{content:'';width:10px;height:10px;border-radius:3px;display:inline-block;}
[data-fl-lg][data-fl-src='plan']::before{background:#8b93a1;}
[data-fl-lg][data-fl-src='adjust']::before{background:#e08a1e;}
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
            x.source && x.source !== 'plan' ? h('i', { 'data-fl-tl-src': '' }, '调整') : null))),
        h('div', { 'data-fl-legend': '' },
          h('span', { 'data-fl-lg': '', 'data-fl-src': 'plan' }, '计划'),
          h('span', { 'data-fl-lg': '', 'data-fl-src': 'adjust' }, '调整（life_adjust）')))
    }

    // ── panel ───────────────────────────────────────────────────
    function Panel() {
      const [config, setConfig] = useState(null)
      const [error, setError] = useState('')
      const [message, setMessage] = useState('')
      const [tab, setTab] = useState('now')
      const [tableName, setTableName] = useState('日常')
      const [weekday, setWeekday] = useState('1')
      const [preview, setPreview] = useState(null)
      const [configPath, setConfigPath] = useState('')
      const [previewAt, setPreviewAt] = useState('')
      const [busy, setBusy] = useState(false)
      const [timeline, setTimeline] = useState([])
      const [currentMinute, setCurrentMinute] = useState(0)

      const load = async () => {
        try {
          const data = await getJson(API + '/state')
          setConfig(data.config)
          setPreview(data.preview)
          setConfigPath(data.configPath || '')
          setTimeline(data.timeline || [])
          setCurrentMinute(data.currentMinute || 0)
          setError('')
        } catch (e) { setError('读不到配置：' + e.message) }
      }
      useEffect(() => { load() }, [])

      const patch = (path, value) => setConfig((prev) => (prev ? setPath(prev, path, value) : prev))

      const save = async () => {
        if (!config) return
        setBusy(true); setMessage('保存中…')
        try {
          const data = await postJson(API + '/save', { config })
          setConfig(data.config); setPreview(data.preview)
          setTimeline(data.timeline || []); setCurrentMinute(data.currentMinute || 0)
          setMessage('已保存，下一轮就用新配置')
        } catch (e) { setMessage('保存失败：' + e.message) }
        setBusy(false)
      }

      const previewOther = async () => {
        try {
          const ts = previewAt ? new Date(previewAt).getTime() : Date.now()
          const data = await getJson(API + '/preview?ts=' + ts)
          setPreview(data.preview); setTimeline(data.timeline || []); setCurrentMinute(data.currentMinute || 0)
          setMessage('以下是在 ' + new Date(ts).toLocaleString() + ' 算出来的')
        } catch (e) { setMessage('预览失败：' + e.message) }
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
          h('button', { 'data-fl-btn': '', onClick: async () => { setPreviewAt(''); await load(); setMessage('回到此刻') } }, '回到此刻')),
        h('div', { 'data-fl-note': '' }, '时序图里红线是此刻；灰色的段是按计划走，橙色的段是你用 life_adjust 改过的。'))

      const nowPage = h('div', { 'data-fl-sec': '' },
        h('div', { 'data-fl-h': '' }, '今天的时序'),
        h(TimelineChart, { timeline, currentMinute }),
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
          h('div', { 'data-fl-note': '' }, '配置文件：' + (configPath || '（未知）')),
          h('div', { 'data-fl-note': '' }, '改完点上面的「保存」。')))

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

      return h('div', { 'data-fl-wrap': '' },
        h('div', { 'data-fl-row': '' },
          h('button', { 'data-fl-btn': '', 'data-fl-main': '', disabled: busy, onClick: save }, busy ? '保存中…' : '保存'),
          h('button', { 'data-fl-btn': '', onClick: load }, '重新读取'),
          h('span', { 'data-fl-msg': '' }, message)),
        h('div', { 'data-fl-tabs': '' }, tabs.map(([k, t]) => h('button', {
          key: k, 'data-fl-tab': '', 'data-fl-on': tab === k ? '' : undefined, onClick: () => setTab(k),
        }, t))),
        tab === 'now' ? nowPage : null,
        tab === 'year' ? yearPage : null,
        tab === 'week' ? weekPage : null,
        tab === 'day' ? dayPage : null,
        tab === 'body' ? bodyPage : null,
        tab === 'events' ? eventsPage : null,
        tab === 'photo' ? h(IMAGE.Panel) : null,
        h('div', { 'data-fl-msg': '' }, message))
    }


    // ── 鱼的照片（原 dsh-feiyu-image 的设置页，0.6.0 起并进来）──
    // 单独一层作用域，免得和上面的 h / CSS / API 撞名。
    const IMAGE = (() => {
      const API = '/dsh-feiyu-image'

      const CSS = `
  [data-fi-wrap]{display:flex;flex-direction:column;gap:14px;padding:4px 2px 24px;color-scheme:light dark;font-size:13px;}
  [data-fi-wrap] input,[data-fi-wrap] select,[data-fi-wrap] textarea{background:Canvas;color:CanvasText;border:1px solid rgba(127,127,127,.35);border-radius:6px;padding:5px 8px;font-size:13px;font-family:inherit;}
  [data-fi-wrap] textarea{width:100%;min-height:64px;resize:vertical;line-height:1.5;}
  [data-fi-wrap] input[type=number]{width:88px;}
  [data-fi-sec]{display:flex;flex-direction:column;gap:8px;}
  [data-fi-h]{font-size:13px;font-weight:600;opacity:.85;padding-top:10px;border-top:1px solid rgba(127,127,127,.18);}
  [data-fi-note]{font-size:12px;opacity:.62;line-height:1.55;}
  [data-fi-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  [data-fi-btn]{padding:5px 12px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);color:inherit;cursor:pointer;font-size:13px;}
  [data-fi-btn]:hover{background:rgba(127,127,127,.16);}
  [data-fi-btn][disabled]{opacity:.45;cursor:default;}
  [data-fi-btn][data-primary]{background:rgba(64,128,255,.16);border-color:rgba(64,128,255,.5);}
  [data-fi-grid]{display:flex;gap:8px;flex-wrap:wrap;}
  [data-fi-grid] img{width:104px;height:104px;object-fit:cover;border-radius:8px;border:1px solid rgba(127,127,127,.3);}
  [data-fi-chip]{font-size:12px;padding:2px 8px;border-radius:999px;background:rgba(127,127,127,.14);}
  [data-fi-chip][data-ok]{background:rgba(60,180,110,.18);}
  [data-fi-chip][data-bad]{background:rgba(230,90,80,.18);}
  [data-fi-msg]{font-size:12px;min-height:16px;opacity:.75;}
  [data-fi-preview]{max-width:100%;border-radius:10px;border:1px solid rgba(127,127,127,.3);}
  `

      function 字段(props) {
        return h('label', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          h('span', { style: { fontSize: 12, opacity: 0.7 } }, props.label),
          props.children)
      }

      function Panel() {
        const [st, setSt] = useState(null)
        const [cfg, setCfg] = useState(null)
        const [msg, setMsg] = useState('')
        const [busy, setBusy] = useState(false)
        const [试拍, set试拍] = useState({ 提示: '在宿舍书桌前托腮看镜头', 穿着: '', 表情: '', 类型: 'selfie' })
        const [结果, set结果] = useState(null)
        const [模型表, set模型表] = useState([])
        const [模型注, set模型注] = useState('')
        const [手填, set手填] = useState(false)

        const 拉模型 = async (强制) => {
          set模型注('拉取中…')
          try {
            const r = await fetch(`${API}/models${强制 ? '?f=1' : ''}`, { credentials: 'same-origin' })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '拉不到模型列表')
            set模型表(d.列表 || [])
            set模型注(d.拉取失败
              ? '没拉到，先用内置名单：' + String(d.拉取失败).slice(0, 80)
              : `${(d.列表 || []).length} 个可选${d.缓存 ? '（缓存 10 分钟）' : ''}`)
          } catch (e) {
            set模型表([]); set模型注('拉取失败：' + String((e && e.message) || e).slice(0, 100))
          }
        }

        const 拉 = async () => {
          try {
            const r = await fetch(`${API}/state`, { credentials: 'same-origin' })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '读不到状态')
            setSt(d); setCfg(d.配置)
          } catch (e) { setMsg('读取失败：' + String(e.message || e)) }
        }
        useEffect(() => { 拉() }, [])
        useEffect(() => { 拉模型() }, [])

        const 改 = (k) => (e) => setCfg({ ...cfg, [k]: e && e.target ? e.target.value : e })
        const 改数 = (k) => (e) => setCfg({ ...cfg, [k]: Number(e.target.value) })
        const 改勾 = (k) => (e) => setCfg({ ...cfg, [k]: Boolean(e.target.checked) })

        const 保存 = async () => {
          setBusy(true); setMsg('保存中…')
          try {
            const r = await fetch(`${API}/save`, {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ 配置: cfg }),
            })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '保存失败')
            setMsg('已保存，下一张就按新配置走'); setCfg(d.配置)
            await 拉()
          } catch (e) { setMsg('保存失败：' + String(e.message || e)) } finally { setBusy(false) }
        }

        const 去拍 = async () => {
          setBusy(true); setMsg('正在拍，方舟大概 30 秒…'); set结果(null)
          try {
            const r = await fetch(`${API}/test`, {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(试拍),
            })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '试拍失败')
            const 名 = String(d.图 || '').split('/').pop()
            const 检 = d.自检 || null
            set结果({ url: `${API}/file?n=${encodeURIComponent(名)}`, 提示词: d.提示词, 大小: d.大小, 自检: 检, 记录: d.记录 || [] })
            setMsg(检 ? (检.合格 ? '拍好了，自检过了' : '拍好了，但自检说不合格') : '拍好了')
            await 拉()
          } catch (e) { setMsg('试拍失败：' + String(e.message || e)) } finally { setBusy(false) }
        }

        if (!st || !cfg) return h('div', { 'data-fi-wrap': '' }, h('div', { 'data-fi-note': '' }, msg || '读取中…'))

        const 照片 = st.照片 || []
        const 用Ark = true

        return h('div', { 'data-fi-wrap': '' },
          // 状态
          h('div', { 'data-fi-row': '' },
            h('span', { 'data-fi-chip': '', 'data-ok': st.ark && st.ark.ok ? '' : undefined },
              st.ark && st.ark.ok ? '方舟 已连接' : '方舟 未配置'),
            h('span', { 'data-fi-chip': '', 'data-bad': st.有参考图 ? undefined : '' },
              st.有参考图 ? '参考图 有' : '参考图 缺'),
            h('span', { 'data-fi-chip': '' }, `今日 ${st.今日}/${st.上限}`),
            h('span', { 'data-fi-chip': '' }, '后端 火山方舟')),

          // 后端
          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '模型'),
            h('div', { 'data-fi-row': '' },
              h(字段, { label: '模型（自动从后端拉）' },
                h('div', { 'data-fi-row': '' },
                  (手填 || !模型表.length)
                    ? h('input', { value: cfg.模型 || '', onChange: 改('模型'), placeholder: '手填模型 id', style: { width: 300 } })
                    : h('select', {
                        value: 模型表.includes(cfg.模型) ? cfg.模型 : '__keep',
                        style: { width: 300 },
                        onChange: (e) => {
                          const v = e.target.value
                          if (v === '__custom') { set手填(true); return }
                          if (v === '__keep') return
                          setCfg({ ...cfg, 模型: v })
                        },
                      },
                      ...(模型表.includes(cfg.模型) ? [] : [h('option', { key: '__keep', value: '__keep' }, `当前：${cfg.模型 || '(空)'}`)]),
                      ...模型表.map((id) => h('option', { key: id, value: id }, id)),
                      h('option', { key: '__custom', value: '__custom' }, '手填…')),
                  h('button', { 'data-fi-btn': '', onClick: () => 拉模型(true) }, '刷新'),
                  手填 ? h('button', { 'data-fi-btn': '', onClick: () => set手填(false) }, '改用列表') : null))),
            h('div', { 'data-fi-row': '' },
              h('label', { 'data-fi-row': '' },
                h('input', { type: 'checkbox', checked: Boolean(cfg.用参考图), onChange: 改勾('用参考图') }),
                h('span', {}, '用参考图锁角色（方舟专用）')),
              h(字段, { label: '参考图路径' },
                h('input', { value: cfg.参考图 || '', onChange: 改('参考图'), placeholder: '留空 = ~/.dsh/feiyu-image/角色设定/正面.jpg', style: { width: 420 } }))),
            h('div', { 'data-fi-note': '' },
              (模型注 ? `模型列表：${模型注}。` : '') + '列表是实时问方舟要的，新出的模型会自动出现。')),

          // 形象
          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '形象与画风'),
            h(字段, { label: '固定特征（长相，每次一字不差带上）' },
              h('textarea', { value: cfg.外观 || '', onChange: 改('外观') })),
            h(字段, { label: '默认服装（可被「穿着」参数覆盖）' },
              h('textarea', { value: cfg.服装 || '', onChange: 改('服装') })),
            h(字段, { label: '画风' },
              h('textarea', { value: cfg.风格 || '', onChange: 改('风格') })),
            h(字段, { label: '镜头（自拍时用）' },
              h('textarea', { value: cfg.镜头 || '', onChange: 改('镜头') })),
            h(字段, { label: '默认表情' },
              h('input', { value: cfg.表情 || '', onChange: 改('表情') })),
            h(字段, { label: '画面细节（越具体越像真的）' },
              h('textarea', { value: cfg.细节 || '', onChange: 改('细节') })),
            h('div', { 'data-fi-row': '' },
              h(字段, { label: '画幅' },
                h('select', { value: cfg.画幅 || '竖幅', onChange: 改('画幅') },
                  h('option', { value: '竖幅' }, '竖幅 1440×1920（手机自拍）'),
                  h('option', { value: '方形' }, '方形 2048×2048'),
                  h('option', { value: '横幅' }, '横幅 1920×1440'))),
              h('div', { 'data-fi-note': '', style: { flex: 1 } },
                '穿着默认取生活线里「此刻」那一段（不用填）；一张 60–100 秒。'))),

          // 节流
          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '节流'),
            h('div', { 'data-fi-row': '' },
              h(字段, { label: '每天最多' }, h('input', { type: 'number', value: cfg.每日上限, onChange: 改数('每日上限') })),
              h(字段, { label: '两次最短间隔（秒）' }, h('input', { type: 'number', value: cfg.最短间隔秒, onChange: 改数('最短间隔秒') })),
              h(字段, { label: '存图目录（留空=默认）' }, h('input', { value: cfg.存图目录 || '', onChange: 改('存图目录'), style: { width: 320 } }))),
            h('div', { 'data-fi-row': '' },
              h('label', { 'data-fi-row': '' },
                h('input', { type: 'checkbox', checked: cfg.出图自检 !== false, onChange: 改勾('出图自检') }),
                h('span', {}, '出图后自检（看一眼角色/画风/画崩/文字水印）')),
              h(字段, { label: '不合格最多重拍' },
                h('input', { type: 'number', value: cfg.自检重拍 ?? 1, min: 0, max: 2, onChange: 改数('自检重拍') }))),
            h('div', { 'data-fi-note': '' },
              '自检要花一次视觉调用，约 5–10 秒；重拍会多出一张图，也算今天的额度。')),

          // 保存
          h('div', { 'data-fi-row': '' },
            h('button', { 'data-fi-btn': '', 'data-primary': '', disabled: busy, onClick: 保存 }, '保存'),
            h('button', { 'data-fi-btn': '', disabled: busy, onClick: 拉 }, '重新读取'),
            h('span', { 'data-fi-msg': '' }, msg)),

          // 试拍
          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '试拍（不进对话，直接看效果）'),
            h('div', { 'data-fi-row': '' },
              h(字段, { label: '画面' },
                h('input', { value: 试拍.提示, onChange: (e) => set试拍({ ...试拍, 提示: e.target.value }), style: { width: 360 } })),
              h(字段, { label: '穿着（可空）' },
                h('input', { value: 试拍.穿着, onChange: (e) => set试拍({ ...试拍, 穿着: e.target.value }), placeholder: '睡衣 / 卫衣 / 浴巾' })),
              h(字段, { label: '表情（可空）' },
                h('input', { value: 试拍.表情 || '', onChange: (e) => set试拍({ ...试拍, 表情: e.target.value }), placeholder: '偷笑 / 困 / 委屈' })),
              h(字段, { label: '类型' },
                h('select', { value: 试拍.类型, onChange: (e) => set试拍({ ...试拍, 类型: e.target.value }) },
                  h('option', { value: 'selfie' }, '自拍'),
                  h('option', { value: 'scene' }, '只拍场景'))),
              h('button', { 'data-fi-btn': '', 'data-primary': '', disabled: busy, onClick: 去拍 }, 用Ark ? '拍一张（约 35 秒）' : '拍一张')),
            h('div', { 'data-fi-note': '' }, '用的是保存后的配置；如果刚改过参数，先点保存。'),
            result(结果) ? h('div', { 'data-fi-sec': '' },
              h('img', { 'data-fi-preview': '', src: 结果.url, alt: '试拍结果' }),
              h('div', { 'data-fi-note': '' },
                (结果.自检
                  ? (结果.自检.合格 ? '自检：合格 ' : '自检：不合格 ')
                    + (结果.自检.问题 && 结果.自检.问题.length ? '· ' + 结果.自检.问题.join('；') + ' ' : '')
                    + (结果.自检.合格 ? '' : '· 改法：' + (结果.自检.改法 || '无'))
                  : '自检：没跑成'),
                ...(结果.记录 || []).map((x, i) => h('div', { key: 'r' + i, 'data-fi-note': '' }, '· ' + x)),
              ),
              h('div', { 'data-fi-note': '' }, `提示词：${结果.提示词}`)) : null),

          // 最近照片
          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, `最近的照片（${照片.length}）`),
            h('div', { 'data-fi-grid': '' },
              ...照片.map((p) => h('img', {
                key: p.名,
                src: `${API}/file?n=${encodeURIComponent(p.名)}`,
                title: `${p.名} · ${Math.round(p.大小 / 1024)}KB`,
                alt: p.名,
              }))))
        )
      }

      function result(x) { return x && x.url }
      return { Panel, CSS }
    })()

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
        style2.textContent = IMAGE.CSS
        document.head.appendChild(style2)
        ctx.effect(() => () => style2.remove(), 'dsh-feiyu-image: settings css')

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'feiyu-life', order: 56, label: '鱼的生活' },
          () => h(Panel),
        ))

      },
    }
  },
})
