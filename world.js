import { xueyuanGeometry } from './assets/maps/xueyuan-world.js'

// Spatial layer for the character's life.
//
// The timeline remains the source of truth. This module adds a logical map,
// infers a place/behaviour for each segment and inserts deterministic travel
// segments when two consecutive activities happen in different places.

export const defaultWorldConfig = {
  启用: true,
  自动通勤: true,
  底图: 'xueyuan-road',
  地点: [
    { id: 'dorm', name: '学生公寓', ...xueyuanGeometry.locations.dorm, 关键词: ['宿舍', '公寓', '床', '睡', '起床', '洗澡', '洗漱', '刷手机', '剪片', '修图', '游戏', '看剧', '外卖'] },
    { id: 'classroom', name: '教学楼', ...xueyuanGeometry.locations.classroom, 关键词: ['上课', '教室', '教学楼', '专业课', '讲座', '点名', '课件'] },
    { id: 'library', name: '矿大图书馆', ...xueyuanGeometry.locations.library, 关键词: ['图书馆', '自习', '背书', '复习'] },
    { id: 'canteen', name: '裕园餐厅', ...xueyuanGeometry.locations.canteen, 关键词: ['食堂', '裕园', '餐厅', '吃饭', '早餐', '午饭', '晚饭', '排队'] },
    { id: 'shop', name: '幸福超市 · 快递点', ...xueyuanGeometry.locations.shop, 关键词: ['幸福超市', '便利店', '超市', '快递', '取件', '买东西'] },
    { id: 'outdoor', name: '学院路校门', ...xueyuanGeometry.locations.outdoor, 关键词: ['外面', '街上', '学院路', '公园', '书店', '电影院', '拍照', '校门口', '地铁', '公交'] },
    { id: 'cafe', name: '咖啡屋 · 上岛咖啡', ...xueyuanGeometry.locations.cafe, 关键词: ['上岛咖啡', '咖啡屋', '咖啡店', '咖啡馆', '咖啡厅', '喝咖啡'] },
    { id: 'mall', name: 'BOM 嘻番里', ...xueyuanGeometry.locations.mall, 关键词: ['BOM嘻番里', '嘻番里', '商场', '逛商场', '买谷', '谷子店', '手办', '桌游'] },
    { id: 'mcdonalds', name: '麦当劳 · 成府路', ...xueyuanGeometry.locations.mcdonalds, 关键词: ['麦当劳', '麦门', '成府路麦当劳', '汉堡', '薯条', '麦旋风'] },
  ],
  路径: xueyuanGeometry.paths,
}

export const BEHAVIOR_RULES = [
  { id: 'sleep', label: '睡觉', include: ['睡', '睡觉', '睡着', '午睡', '补觉', '打盹', '眯一会', '躺平'], exclude: ['睡不着', '没睡', '不睡', '叫醒'] },
  { id: 'walk', label: '移动中', include: ['步行', '走路', '散步', '在路上', '赶路', '出发', '去往', '回宿舍', '回学校', '坐地铁', '乘地铁', '坐公交', '乘公交', '骑车', '打车'] },
  { id: 'eat', label: '吃东西', include: ['吃饭', '吃早饭', '吃早餐', '吃午饭', '吃晚饭', '吃夜宵', '吃面', '吃粉', '吃零食', '吃外卖', '食堂', '早餐', '午餐', '午饭', '晚餐', '晚饭', '夜宵', '喝奶茶', '喝咖啡', '喝饮料', '用餐'], exclude: ['等外卖', '点外卖', '叫外卖', '拿外卖', '取外卖'] },
  { id: 'study', label: '学习 / 创作', include: ['上课', '听课', '自习', '背书', '复习', '看书', '读书', '作业', '课件', '写稿', '改稿', '写作', '码字', '论文', '画画', '画稿', '绘图', '设计', '海报', '剪片', '剪视频', '修图'] },
  { id: 'photo', label: '拍照', include: ['拍照', '照相', '自拍', '拍视频', '拿相机', '带着相机'] },
  { id: 'bath', label: '洗漱', include: ['洗澡', '冲澡', '淋浴', '泡澡', '洗漱', '刷牙', '洗脸', '护肤', '敷面膜', '洗头', '吹头发'] },
  { id: 'phone', label: '玩手机', include: ['刷手机', '看手机', '玩手机', '回消息', '回微信', '打游戏', '玩游戏', '刷B站', '刷 B 站', '看剧', '追剧', '刷视频', '看视频', '刷微博', '刷小红书'] },
]

const normalizeText = (value) => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s，。！？、,.!?：:；;“”‘’'"（）()【】[\]·…—_-]+/g, '')

const includesAny = (text, words) => words.some((word) => text.includes(normalizeText(word)))

const firstPersonClause = (text, verb) => String(text || '')
  .split(/[，。！？,.!?；;]/)
  .find((clause) => new RegExp('(?:我|自己|本人|她)[^，。！？,.!?；;]{0,8}' + verb).test(clause))

const hasFirstPersonAction = (text, verb) => {
  const clause = firstPersonClause(text, verb)
  return Boolean(clause && !/(?:只|没|没有|不|还没)[^，。！？,.!?；;]{0,4}(?:吃|喝|睡|眯)/.test(clause))
}

const actionAfterWatching = (text, verb) => !hasFirstPersonAction(text, verb) && String(text || '')
  .split(/[，。！？,.!?；;]/)
  .some((clause) => new RegExp(
    '(?:看|望|瞧|盯|陪|等|给|让|喂|看着|望着|瞧着|盯着)(?:着|见|到)?(?:它|他|她|猫|狗|小猫|小狗|室友|朋友|别人)?[^，。！？,.!?；;]{0,8}' + verb,
  ).test(clause))

const clone = (value) => JSON.parse(JSON.stringify(value))
const clamp = (value, min, max, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const tenth = (value) => Math.round(value * 10) / 10

export function normalizeWorldConfig(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const nodes = Array.isArray(raw.地点) ? raw.地点 : defaultWorldConfig.地点
  const seen = new Set()
  const normalizedNodes = nodes.flatMap((node, i) => {
    if (!node || typeof node !== 'object') return []
    const id = String(node.id || `place-${i + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
    if (!id || seen.has(id)) return []
    seen.add(id)
    return [{
      id,
      name: String(node.name || id).trim().slice(0, 40) || id,
      x: tenth(clamp(node.x, 4, 96, 50)),
      y: tenth(clamp(node.y, 8, 92, 50)),
      关键词: Array.isArray(node.关键词)
        ? node.关键词.map((x) => String(x || '').trim().slice(0, 24)).filter(Boolean).slice(0, 30)
        : [],
    }]
  })
  const safeNodes = normalizedNodes.length >= 2 ? normalizedNodes : clone(defaultWorldConfig.地点)
  const ids = new Set(safeNodes.map((x) => x.id))
  const paths = (Array.isArray(raw.路径) ? raw.路径 : defaultWorldConfig.路径).flatMap((edge) => {
    if (!edge || !ids.has(String(edge.from)) || !ids.has(String(edge.to)) || edge.from === edge.to) return []
    const via = Array.isArray(edge.via) ? edge.via.flatMap((point) => {
      if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return []
      return [{ x: tenth(clamp(point.x, 0, 100, 50)), y: tenth(clamp(point.y, 0, 100, 50)) }]
    }).slice(0, 32) : []
    return [{ from: String(edge.from), to: String(edge.to), minutes: Math.round(clamp(edge.minutes, 1, 180, 10)), ...(via.length ? { via } : {}) }]
  })
  return {
    启用: raw.启用 !== false,
    自动通勤: raw.自动通勤 !== false,
    底图: raw.底图 === 'none' ? 'none' : 'xueyuan-road',
    地点: safeNodes,
    路径: paths.length ? paths : clone(defaultWorldConfig.路径).filter((x) => ids.has(x.from) && ids.has(x.to)),
  }
}

export function behaviorFor(what) {
  const raw = String(what || '')
  const text = normalizeText(raw)
  const candidates = []
  for (const rule of BEHAVIOR_RULES) {
    if (!includesAny(text, rule.include)) continue
    if (includesAny(text, rule.exclude || [])) continue
    if (rule.id === 'eat' && actionAfterWatching(raw, '吃|喝')) continue
    if (rule.id === 'sleep' && actionAfterWatching(raw, '睡|眯')) continue
    const specificity = Math.max(...rule.include
      .map((word) => normalizeText(word))
      .filter((word) => text.includes(word))
      .map((word) => [...word].length))
    candidates.push({ id: rule.id, specificity })
  }
  return candidates.sort((a, b) => b.specificity - a.specificity)[0]?.id || 'idle'
}

function locationForNormalized(what, world) {
  const text = String(what || '')
  let best = null
  for (const node of world.地点) {
    for (const word of node.关键词 || []) {
      if (!word || !text.includes(word)) continue
      const score = [...word].length
      if (!best || score > best.score) best = { id: node.id, score }
    }
  }
  if (best) return best.id
  // Existing v3 configs may not yet contain newly added café keywords. Explicit
  // off-campus destinations must not silently fall back to the dorm.
  if (/咖啡店|咖啡馆|咖啡厅|书店|餐厅|饭店|电影院|影院/.test(text)) {
    const outdoor = world.地点.find((x) => x.id === 'outdoor')
      || world.地点.find((x) => /校外|街上|户外/.test(String(x.name || '')))
    if (outdoor) return outdoor.id
  }
  return world.地点.find((x) => x.id === 'dorm')?.id || world.地点[0]?.id || ''
}

export function locationFor(what, worldConfig = defaultWorldConfig) {
  return locationForNormalized(what, normalizeWorldConfig(worldConfig))
}

export function inferenceFor(what, worldConfig = defaultWorldConfig) {
  const world = normalizeWorldConfig(worldConfig)
  const locationId = locationForNormalized(what, world)
  const behavior = behaviorFor(what)
  return {
    text: String(what || ''),
    locationId,
    location: world.地点.find((node) => node.id === locationId) || null,
    behavior,
    behaviorLabel: BEHAVIOR_RULES.find((rule) => rule.id === behavior)?.label || '发呆',
  }
}

function shortestRoute(world, from, to) {
  if (!from || !to || from === to) return { nodes: [from].filter(Boolean), minutes: 0, legs: [] }
  const graph = new Map(world.地点.map((node) => [node.id, []]))
  for (const edge of world.路径) {
    if (!graph.has(edge.from) || !graph.has(edge.to)) continue
    graph.get(edge.from).push({ to: edge.to, minutes: edge.minutes, via: edge.via || [] })
    graph.get(edge.to).push({ to: edge.from, minutes: edge.minutes, via: [...(edge.via || [])].reverse() })
  }
  const dist = new Map([[from, 0]])
  const prev = new Map()
  const open = new Set([from])
  while (open.size) {
    let current = null
    for (const id of open) if (current === null || dist.get(id) < dist.get(current)) current = id
    open.delete(current)
    if (current === to) break
    for (const edge of graph.get(current) || []) {
      const next = (dist.get(current) || 0) + edge.minutes
      if (next >= (dist.get(edge.to) ?? Infinity)) continue
      dist.set(edge.to, next)
      prev.set(edge.to, { from: current, minutes: edge.minutes, via: edge.via || [] })
      open.add(edge.to)
    }
  }
  if (!dist.has(to)) return { nodes: [from, to], minutes: 12, legs: [{ from, to, minutes: 12 }] }
  const nodes = [to]
  const legs = []
  let cursor = to
  while (cursor !== from) {
    const p = prev.get(cursor)
    if (!p) break
    legs.unshift({ from: p.from, to: cursor, minutes: p.minutes, ...(p.via.length ? { via: p.via } : {}) })
    cursor = p.from
    nodes.unshift(cursor)
  }
  return { nodes, minutes: dist.get(to), legs }
}

/** Decorate timeline segments and reserve the final minutes before a location change for travel. */
export function addWorldToTimeline(timeline, worldConfig = defaultWorldConfig) {
  const world = normalizeWorldConfig(worldConfig)
  let previousLocationId = world.地点.find((x) => x.id === 'dorm')?.id || world.地点[0]?.id || ''
  let previousEnd = null
  const rows = (timeline || []).slice().sort((a, b) => a.start - b.start).map((item) => {
    const explicitLocationId = world.地点.some((node) => node.id === item.locationId) ? item.locationId : ''
    const inferredLocationId = explicitLocationId || locationForNormalized(item.what, world)
    const ambiguous = !explicitLocationId && inferredLocationId === (world.地点.find((x) => x.id === 'dorm')?.id || world.地点[0]?.id || '')
      && !world.地点.some((node) => (node.关键词 || []).some((word) => word && String(item.what || '').includes(word)))
    const locationId = ambiguous && previousEnd === item.start ? previousLocationId : inferredLocationId
    previousLocationId = locationId || previousLocationId
    previousEnd = item.end
    return {
      ...item,
      locationId,
      behavior: item.behavior || behaviorFor(item.what),
    }
  })
  if (!world.启用 || !world.自动通勤 || rows.length < 2) return rows
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const current = { ...rows[i] }
    const next = rows[i + 1]
    if (!next || current.locationId === next.locationId || current.end !== next.start) {
      out.push(current)
      continue
    }
    const route = shortestRoute(world, current.locationId, next.locationId)
    const availableMinutes = Math.max(1, (current.end - current.start) / 60000)
    const duration = Math.max(60000, Math.min(route.minutes, Math.max(1, availableMinutes - 1)) * 60000)
    const travelStart = Math.max(current.start, current.end - duration)
    if (travelStart > current.start) out.push({ ...current, end: travelStart })
    out.push({
      start: travelStart,
      end: current.end,
      what: `从${world.地点.find((x) => x.id === current.locationId)?.name || '这里'}去${world.地点.find((x) => x.id === next.locationId)?.name || '下一站'}`,
      phone: '不在手边',
      outfit: current.outfit || next.outfit || '',
      source: 'travel',
      behavior: 'walk',
      locationId: current.locationId,
      from: current.locationId,
      to: next.locationId,
      route: route.nodes,
      legs: route.legs,
    })
  }
  return out.filter((x) => x.end > x.start).sort((a, b) => a.start - b.start)
}

function interpolateRoute(world, segment, progress) {
  const byId = new Map(world.地点.map((node) => [node.id, node]))
  const legs = Array.isArray(segment.legs) && segment.legs.length
    ? segment.legs
    : [{ from: segment.from, to: segment.to, minutes: 1 }]
  const total = legs.reduce((sum, leg) => sum + Math.max(1, Number(leg.minutes) || 1), 0)
  let cursor = Math.max(0, Math.min(1, progress)) * total
  for (const leg of legs) {
    const minutes = Math.max(1, Number(leg.minutes) || 1)
    if (cursor > minutes) { cursor -= minutes; continue }
    const a = byId.get(leg.from)
    const b = byId.get(leg.to)
    if (!a || !b) break
    const points = [a, ...(Array.isArray(leg.via) ? leg.via : []), b]
    const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y))
    const totalLength = lengths.reduce((sum, length) => sum + length, 0) || 1
    let along = cursor / minutes * totalLength
    for (let i = 0; i < lengths.length; i++) {
      if (along > lengths[i]) { along -= lengths[i]; continue }
      const p = along / Math.max(lengths[i], Number.EPSILON)
      return { x: points[i].x + (points[i + 1].x - points[i].x) * p, y: points[i].y + (points[i + 1].y - points[i].y) * p }
    }
    return { x: b.x, y: b.y }
  }
  const last = byId.get(segment.to) || byId.get(segment.from)
  return { x: last?.x ?? 50, y: last?.y ?? 50 }
}

export function worldStateAt(timeline, nowMs, worldConfig = defaultWorldConfig) {
  const world = normalizeWorldConfig(worldConfig)
  const current = (timeline || []).find((x) => nowMs >= x.start && nowMs < x.end) || timeline?.[0]
  if (!current) return { enabled: world.启用, nodes: world.地点, edges: world.路径, behavior: 'idle', position: { x: 50, y: 50 } }
  if (!world.启用) return {
    enabled: false,
    behavior: current.behavior || behaviorFor(current.what),
    moving: false,
    progress: 0,
    location: null,
    destination: null,
    position: { x: 50, y: 50 },
    what: String(current.what || ''),
    route: [],
  }
  const moving = current.source === 'travel'
  const progress = moving ? Math.max(0, Math.min(1, (nowMs - current.start) / Math.max(1, current.end - current.start))) : 0
  const location = world.地点.find((x) => x.id === current.locationId) || world.地点[0]
  const destination = moving ? world.地点.find((x) => x.id === current.to) : null
  return {
    enabled: world.启用,
    behavior: current.behavior || behaviorFor(current.what),
    moving,
    progress,
    location: location ? { id: location.id, name: location.name, icon: location.icon } : null,
    destination: destination ? { id: destination.id, name: destination.name, icon: destination.icon } : null,
    position: moving ? interpolateRoute(world, current, progress) : { x: location?.x ?? 50, y: location?.y ?? 50 },
    what: String(current.what || ''),
    route: Array.isArray(current.route) ? current.route : [],
  }
}
