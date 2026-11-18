export function createImagePanel(React) {
  const h = React.createElement
  const { useState, useEffect } = React
    // Camera settings panel (merged from dsh-feiyu-image).
      const API = '/dsh-feiyu-life/image'

      const CSS = `
  [data-fi-wrap]{--fi-accent:#167f78;--fi-line:rgba(127,127,127,.18);display:flex;flex-direction:column;gap:16px;padding:4px 2px 28px;color-scheme:light dark;font-size:13px;}
  [data-fi-wrap] input,[data-fi-wrap] select,[data-fi-wrap] textarea{box-sizing:border-box;max-width:100%;background:Canvas;color:CanvasText;border:1px solid rgba(127,127,127,.35);border-radius:7px;padding:6px 8px;font-size:13px;font-family:inherit;}
  [data-fi-wrap] input:focus,[data-fi-wrap] select:focus,[data-fi-wrap] textarea:focus{outline:2px solid rgba(22,127,120,.35);border-color:var(--fi-accent);outline-offset:1px;}
  [data-fi-wrap] textarea{width:100%;min-height:64px;resize:vertical;line-height:1.5;}
  [data-fi-wrap] input[type=number]{width:88px;}
  [data-fi-sec]{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid var(--fi-line);border-radius:14px;background:rgba(127,127,127,.035);}
  [data-fi-h]{font-size:14px;font-weight:700;letter-spacing:-.01em;}
  [data-fi-sub]{margin-top:-5px;font-size:11.5px;opacity:.58;line-height:1.5;}
  [data-fi-note]{font-size:12px;opacity:.62;line-height:1.55;}
  [data-fi-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  [data-fi-between]{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  [data-fi-actions]{position:sticky;top:0;z-index:12;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;margin:0 -10px;border-bottom:1px solid var(--fi-line);background:Canvas;}
  [data-fi-status]{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
  [data-fi-stat]{padding:10px 12px;border:1px solid var(--fi-line);border-radius:11px;background:rgba(127,127,127,.055);min-width:0;}
  [data-fi-stat-k]{font-size:10.5px;opacity:.55;margin-bottom:3px;}
  [data-fi-stat-v]{font-weight:680;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  [data-fi-settings]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;}
  [data-fi-settings] [data-fi-sec][data-fi-wide]{grid-column:1/-1;}
  [data-fi-btn]{padding:5px 12px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);color:inherit;cursor:pointer;font-size:13px;}
  [data-fi-btn]:hover{background:rgba(127,127,127,.16);}
  [data-fi-btn][disabled]{opacity:.45;cursor:default;}
  [data-fi-btn][data-primary]{background:var(--fi-accent);border-color:var(--fi-accent);color:white;font-weight:650;}
  [data-fi-grid]{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;}
  [data-fi-photo]{position:relative;display:block;padding:0;overflow:hidden;border:1px solid var(--fi-line);border-radius:11px;background:rgba(127,127,127,.06);color:inherit;text-align:left;cursor:zoom-in;}
  [data-fi-photo]:hover{border-color:rgba(22,127,120,.55);transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.08);}
  [data-fi-photo] img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:rgba(127,127,127,.08);}
  [data-fi-photo-meta]{display:block;padding:7px 8px;font-size:10.5px;line-height:1.35;opacity:.68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  [data-fi-chip]{font-size:12px;padding:2px 8px;border-radius:999px;background:rgba(127,127,127,.14);}
  [data-fi-chip][data-ok]{background:rgba(60,180,110,.18);}
  [data-fi-chip][data-bad]{background:rgba(230,90,80,.18);}
  [data-fi-msg]{font-size:12px;min-height:16px;opacity:.75;}
  [data-fi-preview]{display:block;max-width:min(100%,520px);max-height:520px;object-fit:contain;border-radius:10px;border:1px solid rgba(127,127,127,.3);cursor:zoom-in;}
  [data-fi-lightbox]{position:fixed;inset:0;z-index:10000;display:grid;grid-template-columns:64px minmax(0,1fr) 64px;grid-template-rows:56px minmax(0,1fr) 104px;align-items:center;background:rgba(6,14,13,.88);backdrop-filter:blur(12px);color:white;}
  [data-fi-lightbox-img]{grid-column:2;grid-row:2;display:block;max-width:100%;max-height:calc(100vh - 180px);margin:auto;object-fit:contain;border-radius:10px;box-shadow:0 18px 70px rgba(0,0,0,.38);}
  [data-fi-lightbox-close]{position:absolute;right:18px;top:14px;width:38px;height:38px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:rgba(0,0,0,.28);color:white;font-size:24px;cursor:pointer;}
  [data-fi-lightbox-nav]{grid-row:2;width:42px;height:58px;margin:auto;border:0;border-radius:10px;background:rgba(255,255,255,.10);color:white;font-size:30px;cursor:pointer;}
  [data-fi-lightbox-nav='prev']{grid-column:1;}[data-fi-lightbox-nav='next']{grid-column:3;}
  [data-fi-lightbox-nav][disabled]{visibility:hidden;}
  [data-fi-lightbox-caption]{grid-column:1/-1;grid-row:3;text-align:center;font-size:12px;line-height:1.55;padding:8px 70px;overflow:hidden;}
  [data-fi-lightbox-caption] strong{display:block;font-size:13px;font-weight:650;color:white;}
  [data-fi-lightbox-caption] span{display:block;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  @media(max-width:760px){[data-fi-status]{grid-template-columns:repeat(2,minmax(0,1fr));}[data-fi-settings]{grid-template-columns:1fr;}[data-fi-settings] [data-fi-sec][data-fi-wide]{grid-column:auto;}[data-fi-grid]{grid-template-columns:repeat(2,minmax(0,1fr));}[data-fi-lightbox]{grid-template-columns:46px minmax(0,1fr) 46px;}[data-fi-lightbox-caption]{padding:0 20px;}}
  `

      function Label(props) {
        return h('label', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          h('span', { style: { fontSize: 12, opacity: 0.7 } }, props.label),
          props.children)
      }

      function Panel() {
        const [status, setStatus] = useState(null)
        const [config, setConfig] = useState(null)
        const [savedConfig, setSavedConfig] = useState(null)
        const [message, setMessage] = useState('')
        const [busy, setBusy] = useState(false)
        const [draft, setDraft] = useState({ type: 'character' })
        const [result, setResult] = useState(null)
        const [models, setModels] = useState([])
        const [modelNote, setModelNote] = useState('')
        const [manual, setManual] = useState(false)
        const [galleryLimit, setGalleryLimit] = useState(8)
        const [lightbox, setLightbox] = useState(null)
        const photos = (status && status.photos) || []
        const dirty = Boolean(config && savedConfig && JSON.stringify(config) !== JSON.stringify(savedConfig))

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

        const load = async (preserveConfig = false, silent = false) => {
          try {
            const r = await fetch(`${API}/state`, { credentials: 'same-origin' })
            const d = await r.json()
            if (!d.ok) throw new Error(d.error || '读不到状态')
            setStatus(d)
            if (!preserveConfig) {
              setConfig(d.config)
              setSavedConfig(clone(d.config))
            }
          } catch (e) { if (!silent) setMessage('读取失败：' + String(e.message || e)) }
        }
        useEffect(() => { load() }, [])
        useEffect(() => { loadModels() }, [])
        useEffect(() => {
          // Preserve the form unconditionally: the request may finish after editing starts.
          const refresh = () => { if (!document.hidden) load(true, true) }
          const timer = window.setInterval(refresh, 30000)
          document.addEventListener('visibilitychange', refresh)
          return () => {
            window.clearInterval(timer)
            document.removeEventListener('visibilitychange', refresh)
          }
        }, [dirty])

        useEffect(() => {
          const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
          window.addEventListener('beforeunload', warn)
          return () => window.removeEventListener('beforeunload', warn)
        }, [dirty])

        useEffect(() => {
          if (!lightbox) return undefined
          const before = document.body.style.overflow
          document.body.style.overflow = 'hidden'
          const onKey = (e) => {
            if (e.key === 'Escape') setLightbox(null)
            const index = photos.findIndex((p) => p.name === lightbox.name)
            if (e.key === 'ArrowLeft' && index > 0) setLightbox(photos[index - 1])
            if (e.key === 'ArrowRight' && index >= 0 && index < photos.length - 1) setLightbox(photos[index + 1])
          }
          document.addEventListener('keydown', onKey)
          return () => {
            document.body.style.overflow = before
            document.removeEventListener('keydown', onKey)
          }
        }, [lightbox, photos])

        const edit = (k) => (e) => setConfig((prev) => ({ ...prev, [k]: e && e.target ? e.target.value : e }))
        const editNum = (k) => (e) => setConfig((prev) => ({ ...prev, [k]: Number(e.target.value) }))
        const editCheck = (k) => (e) => setConfig((prev) => ({ ...prev, [k]: Boolean(e.target.checked) }))

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
            setMessage('已保存，下一张就按新配置走')
            setConfig(d.config); setSavedConfig(clone(d.config))
            await load(false, true)
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
            setResult({
              name, url: `${API}/file?n=${encodeURIComponent(name)}`, prompt: d.prompt, bytes: d.bytes,
              check: d.check || null, notes: d.notes || [], context: d.metadata && d.metadata.context,
              model: d.metadata && d.metadata.model, quality: d.metadata && d.metadata.quality,
            })
            setMessage(d.check ? (d.check.pass ? '拍好了，自检过了' : '拍好了，但自检说不合格') : '拍好了')
            await load(dirty, true)
          } catch (e) { setMessage('试拍失败：' + String(e.message || e)) } finally { setBusy(false) }
        }

        if (!status || !config) return h('div', { 'data-fi-wrap': '' }, h('div', { 'data-fi-note': '' }, message || '读取中…'))

        const reload = async () => {
          if (dirty && !window.confirm('还有未保存的拍照设置，确定放弃并重新读取吗？')) return
          await load(false, false)
          setMessage('已重新读取')
        }

        const photoUrl = (name, thumb = false) => `${API}/file?n=${encodeURIComponent(name)}${thumb ? '&thumb=1' : ''}`
        const visiblePhotos = photos.slice(0, galleryLimit)
        const lightboxIndex = lightbox ? photos.findIndex((p) => p.name === lightbox.name) : -1
        const formatPhotoTime = (time) => new Date(time).toLocaleString('zh-CN', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
        })
        const photoContext = (photo) => {
          const context = photo && photo.context
          return [context && context.location, context && context.activity].filter(Boolean).join(' · ')
        }

        return h('div', { 'data-fi-wrap': '' },
          h('div', { 'data-fi-status': '' },
            h('div', { 'data-fi-stat': '' }, h('div', { 'data-fi-stat-k': '' }, '相机'), h('div', { 'data-fi-stat-v': '' }, config.总开关 !== false ? '已开启' : '已关闭')),
            h('div', { 'data-fi-stat': '' }, h('div', { 'data-fi-stat-k': '' }, '火山方舟'), h('div', { 'data-fi-stat-v': '' }, status.ark && status.ark.ok ? '已连接' : '未配置')),
            h('div', { 'data-fi-stat': '' }, h('div', { 'data-fi-stat-k': '' }, '角色参考库'), h('div', { 'data-fi-stat-v': '' }, status.hasRef ? `${status.refCount || 1} 张` : '缺失')),
            h('div', { 'data-fi-stat': '' }, h('div', { 'data-fi-stat-k': '' }, '今日额度'), h('div', { 'data-fi-stat-v': '' }, `${status.today} / ${status.limit}`))),

          h('div', { 'data-fi-actions': '' },
            h('button', { 'data-fi-btn': '', 'data-primary': '', disabled: busy || !dirty, onClick: save }, busy ? '处理中…' : '保存设置'),
            h('button', { 'data-fi-btn': '', disabled: busy, onClick: reload }, '重新读取'),
            dirty ? h('span', { 'data-fi-chip': '' }, '有未保存修改') : null,
            h('span', { 'data-fi-msg': '' }, message)),

          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-h': '' }, '快速试拍'),
            h('div', { 'data-fi-sub': '' }, '不进入对话，直接验证当前已保存的角色和生图设置。'),
            h('div', { 'data-fi-row': '' },
              h(Label, { label: '类型' }, h('select', { value: draft.type, onChange: (e) => setDraft({ ...draft, type: e.target.value }) },
                h('option', { value: 'character' }, '角色生活照'), h('option', { value: 'scene' }, '只拍场景'))),
              h('button', { 'data-fi-btn': '', 'data-primary': '', disabled: busy || config.总开关 === false, onClick: shoot }, '拍一张')),
            h('div', { 'data-fi-note': '' }, '无需填写提示词：人物身份来自参考图；地点、动作、服装和时间来自此刻生活状态；发型、表情、镜头、光线与场景细节由扩写模块为这一张动态设计。'),
            dirty ? h('div', { 'data-fi-note': '' }, '当前有未保存设置；试拍仍使用上一次保存的配置。') : null,
            result && result.url ? h('div', { 'data-fi-row': '', style: { alignItems: 'flex-start' } },
              h('img', { 'data-fi-preview': '', src: result.url, alt: '试拍结果', onClick: () => setLightbox({ ...result, label: '刚刚的试拍' }) }),
              h('div', { style: { flex: '1 1 260px' } },
                h('div', { 'data-fi-note': '' }, result.check
                  ? (result.check.pass ? '自检合格' : `自检未通过：${(result.check.problems || []).join('；') || '画面有问题'}`)
                  : '未执行自检'),
                ...(result.notes || []).map((x, i) => h('div', { key: 'n' + i, 'data-fi-note': '' }, '· ' + x)),
                h('details', null, h('summary', { 'data-fi-note': '' }, '查看完整提示词'), h('div', { 'data-fi-note': '' }, result.prompt)))) : null),

          h('div', { 'data-fi-sec': '' },
            h('div', { 'data-fi-between': '' },
              h('div', null, h('div', { 'data-fi-h': '' }, '最近的照片'), h('div', { 'data-fi-sub': '' }, `共 ${photos.length} 张；列表只加载轻量缩略图，点击查看原图。`)),
              galleryLimit > 8 ? h('button', { 'data-fi-btn': '', onClick: () => setGalleryLimit(8) }, '收起') : null),
            photos.length ? h('div', { 'data-fi-grid': '' }, ...visiblePhotos.map((p, i) => h('button', {
              key: p.name, type: 'button', 'data-fi-photo': '', onClick: () => setLightbox(p),
              title: `${p.name} · ${Math.round(p.size / 1024)}KB`, 'aria-label': `放大查看 ${formatPhotoTime(p.time)} 的照片`,
            }, h('img', {
              src: photoUrl(p.name, true), alt: p.name, loading: i < 4 ? 'eager' : 'lazy', decoding: 'async',
            }), h('span', { 'data-fi-photo-meta': '' }, `${formatPhotoTime(p.time)}${photoContext(p) ? ' · ' + photoContext(p) : ''}`)))) : h('div', { 'data-fi-note': '' }, '还没有照片。'),
            galleryLimit < photos.length ? h('button', { 'data-fi-btn': '', onClick: () => setGalleryLimit((n) => Math.min(n + 8, photos.length)) }, `再显示 ${Math.min(8, photos.length - galleryLimit)} 张`) : null),

          h('div', { 'data-fi-settings': '' },
            h('div', { 'data-fi-sec': '' },
              h('div', { 'data-fi-h': '' }, '基础与模型'),
              h('div', { 'data-fi-sub': '' }, '控制相机是否可用、Seedream 模型和角色参考图。'),
              h('label', { 'data-fi-row': '' }, h('input', { type: 'checkbox', checked: config.总开关 !== false, onChange: editCheck('总开关') }), h('span', null, '启用拍照工具')),
              h(Label, { label: '主模型' }, h('div', { 'data-fi-row': '' },
                (manual || !models.length) ? h('input', { value: config.模型 || '', onChange: edit('模型'), placeholder: '模型 id', style: { width: 300 } }) : h('select', {
                  value: models.includes(config.模型) ? config.模型 : '__keep', style: { width: 300 },
                  onChange: (e) => {
                    const v = e.target.value
                    if (v === '__custom') { setManual(true); return }
                    if (v !== '__keep') setConfig((prev) => ({ ...prev, 模型: v }))
                  },
                }, ...(models.includes(config.模型) ? [] : [h('option', { key: '__keep', value: '__keep' }, `当前：${config.模型 || '(空)'}`)]),
                ...models.map((id) => h('option', { key: id, value: id }, id)), h('option', { key: '__custom', value: '__custom' }, '手动填写…')),
                h('button', { 'data-fi-btn': '', onClick: () => loadModels(true) }, '刷新列表'), manual ? h('button', { 'data-fi-btn': '', onClick: () => setManual(false) }, '返回列表') : null)),
              h(Label, { label: '备用模型' }, h('input', { value: config.备用模型 || '', onChange: edit('备用模型'), style: { width: '100%' } })),
              h(Label, { label: '人物参考图文件 / 目录（唯一人物输入，最多 10 张）' }, h('textarea', { value: config.参考图 || '', onChange: edit('参考图'), placeholder: '~/.dsh/feiyu-life-image/角色设定\n也可以逐行填写正面、侧面、背面图片', style: { width: '100%' } })),
              h('div', { 'data-fi-note': '' }, status.hasRef
                ? `已识别：${(status.refNames || []).join('、')}`
                : '留空使用插件内置的高清正面图与三视图；填写文件或目录后会完整替换内置参考库。支持 PNG、JPEG、WebP。'),
              h('div', { 'data-fi-note': '' }, modelNote ? `模型列表：${modelNote}` : '模型列表会从方舟实时读取。')),

            h('div', { 'data-fi-sec': '' },
              h('div', { 'data-fi-h': '' }, '生成质量'),
              h('div', { 'data-fi-sub': '' }, '默认使用 Seedream 标准质量模式；2K 更清楚，1.5K 更省时。'),
              h(Label, { label: '输出清晰度' }, h('select', { value: config.清晰度 || '2K', onChange: edit('清晰度') },
                h('option', { value: '2K' }, '2K · 细节优先'), h('option', { value: '1.5K' }, '1.5K · 速度优先'))),
              h('div', { 'data-fi-note': '' }, '提示词始终由插件注入并优先使用模型扩写；模型不可用时自动使用动态本地兜底。'),
              h('label', { 'data-fi-row': '' }, h('input', { type: 'checkbox', checked: config.出图自检 !== false, onChange: editCheck('出图自检') }), h('span', null, '出图后检查角色、肢体和水印')),
              h('div', { 'data-fi-row': '' },
                h(Label, { label: '最多重拍' }, h('input', { type: 'number', value: config.自检重拍 ?? 1, min: 0, max: 2, onChange: editNum('自检重拍') })),
                h(Label, { label: '扩写/自检超时（秒）' }, h('input', { type: 'number', min: 10, max: 300, value: config.模型超时秒, onChange: editNum('模型超时秒') })),
                h(Label, { label: '生图/下载超时（秒）' }, h('input', { type: 'number', min: 30, max: 600, value: config.生图超时秒, onChange: editNum('生图超时秒') }))),
              h(Label, { label: '提示词兜底 Provider / 模型' }, h('div', { 'data-fi-row': '' },
                h('input', { value: config.兜底Provider || '', onChange: edit('兜底Provider'), placeholder: 'deepseek-official' }),
                h('input', { value: config.兜底模型 || '', onChange: edit('兜底模型'), placeholder: 'deepseek-flash' })))),

            h('div', { 'data-fi-sec': '', 'data-fi-wide': '' },
              h('div', { 'data-fi-h': '' }, '动态画面'),
              h('div', { 'data-fi-sub': '' }, '参考图同时固定人物身份与插画语言，但不固定发型、表情、镜头或道具。每张照片都会结合这一刻的生活重新扩写，细节来自当次动作与环境。'),
              h(Label, { label: '画幅' }, h('select', { value: config.画幅 || '竖幅', onChange: edit('画幅') },
                h('option', { value: '竖幅' }, '竖幅 3:4'), h('option', { value: '方形' }, '方形 1:1'), h('option', { value: '横幅' }, '横幅 4:3'))),
              h('div', { 'data-fi-note': '' }, config.清晰度 === '1.5K'
                ? '当前尺寸：竖幅 1344×1792 / 方形 1536×1536 / 横幅 1792×1344'
                : '当前尺寸：竖幅 1776×2368 / 方形 2048×2048 / 横幅 2368×1776')),

            h('div', { 'data-fi-sec': '', 'data-fi-wide': '' },
              h('div', { 'data-fi-h': '' }, '额度与存储'),
              h('div', { 'data-fi-sub': '' }, '限制调用频率，并控制照片在本机保留多久。'),
              h('div', { 'data-fi-row': '' },
                h(Label, { label: '每日上限' }, h('input', { type: 'number', value: config.每日上限, onChange: editNum('每日上限') })),
                h(Label, { label: '最短间隔（秒）' }, h('input', { type: 'number', value: config.最短间隔秒, onChange: editNum('最短间隔秒') })),
                h(Label, { label: '照片保留（天）' }, h('input', { type: 'number', min: 1, max: 3650, value: config.照片保留天数, onChange: editNum('照片保留天数') })),
                h(Label, { label: '存图目录（留空使用默认目录）' }, h('input', { value: config.存图目录 || '', onChange: edit('存图目录'), style: { width: 360 } }))))),

          lightbox ? h('div', { 'data-fi-lightbox': '', role: 'dialog', 'aria-modal': 'true', onClick: (e) => { if (e.target === e.currentTarget) setLightbox(null) } },
            h('button', { 'data-fi-lightbox-close': '', 'aria-label': '关闭预览', onClick: () => setLightbox(null) }, '×'),
            h('button', { 'data-fi-lightbox-nav': 'prev', 'aria-label': '上一张', disabled: lightboxIndex <= 0, onClick: () => setLightbox(photos[lightboxIndex - 1]) }, '‹'),
            h('img', { 'data-fi-lightbox-img': '', src: photoUrl(lightbox.name), alt: lightbox.name || '照片预览' }),
            h('button', { 'data-fi-lightbox-nav': 'next', 'aria-label': '下一张', disabled: lightboxIndex < 0 || lightboxIndex >= photos.length - 1, onClick: () => setLightbox(photos[lightboxIndex + 1]) }, '›'),
            h('div', { 'data-fi-lightbox-caption': '' },
              h('strong', null, lightbox.label || `${lightbox.time ? formatPhotoTime(lightbox.time) : '照片'}${photoContext(lightbox) ? ' · ' + photoContext(lightbox) : ''}`),
              lightbox.context && lightbox.context.outfit ? h('span', null, `穿着：${lightbox.context.outfit}`) : null,
              lightbox.prompt ? h('span', { title: lightbox.prompt }, lightbox.prompt) : null)) : null)
      }

      return { Panel, CSS }

}
