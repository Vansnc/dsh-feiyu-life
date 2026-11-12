// Spatial layer for the character's life.
//
// The timeline remains the source of truth. This module adds a logical map,
// infers a place/behaviour for each segment and inserts deterministic travel
// segments when two consecutive activities happen in different places.

export const defaultWorldConfig = {
  启用: true,
  自动通勤: true,
  地点: [
    { id: 'dorm', name: '宿舍', x: 16, y: 72, icon: '🛏️', 关键词: ['宿舍', '床', '睡', '起床', '洗澡', '洗漱', '刷手机', '剪片', '修图', '游戏', '看剧', '外卖'] },
    { id: 'classroom', name: '教学楼', x: 48, y: 22, icon: '🏫', 关键词: ['上课', '教室', '专业课', '讲座', '点名', '课件'] },
    { id: 'library', name: '图书馆', x: 78, y: 26, icon: '📚', 关键词: ['图书馆', '自习', '背书', '复习'] },
    { id: 'canteen', name: '食堂', x: 48, y: 70, icon: '🍜', 关键词: ['食堂', '吃饭', '早餐', '午饭', '晚饭', '排队'] },
    { id: 'shop', name: '便利店 · 快递点', x: 80, y: 70, icon: '🏪', 关键词: ['便利店', '超市', '快递', '取件', '买东西'] },
    { id: 'outdoor', name: '校外 · 街上', x: 17, y: 24, icon: '🌳', 关键词: ['外面', '街上', '公园', '商场', '咖啡店', '咖啡馆', '咖啡厅', '书店', '餐厅', '电影院', '拍照', '逛', '校门口', '地铁', '公交'] },
  ],
  路径: [
    { from: 'dorm', to: 'canteen', minutes: 8 },
    { from: 'dorm', to: 'classroom', minutes: 14 },
    { from: 'dorm', to: 'outdoor', minutes: 10 },
    { from: 'canteen', to: 'classroom', minutes: 9 },
    { from: 'canteen', to: 'library', minutes: 10 },
    { from: 'canteen', to: 'shop', minutes: 7 },
    { from: 'classroom', to: 'library', minutes: 8 },
    { from: 'library', to: 'shop', minutes: 9 },
    { from: 'outdoor', to: 'classroom', minutes: 12 },
    { from: 'outdoor', to: 'shop', minutes: 15 },
  ],
}

const clone = (value) => JSON.parse(JSON.stringify(value))
const clamp = (value, min, max, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

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
      x: Math.round(clamp(node.x, 4, 96, 50)),
      y: Math.round(clamp(node.y, 8, 92, 50)),
      icon: String(node.icon || '📍').slice(0, 8),
      关键词: Array.isArray(node.关键词)
        ? node.关键词.map((x) => String(x || '').trim().slice(0, 24)).filter(Boolean).slice(0, 30)
        : [],
    }]
  })
  const safeNodes = normalizedNodes.length >= 2 ? normalizedNodes : clone(defaultWorldConfig.地点)
  const ids = new Set(safeNodes.map((x) => x.id))
  const paths = (Array.isArray(raw.路径) ? raw.路径 : defaultWorldConfig.路径).flatMap((edge) => {
    if (!edge || !ids.has(String(edge.from)) || !ids.has(String(edge.to)) || edge.from === edge.to) return []
    return [{ from: String(edge.from), to: String(edge.to), minutes: Math.round(clamp(edge.minutes, 1, 180, 10)) }]
  })
  return {
    启用: raw.启用 !== false,
    自动通勤: raw.自动通勤 !== false,
    地点: safeNodes,
    路径: paths.length ? paths : clone(defaultWorldConfig.路径).filter((x) => ids.has(x.from) && ids.has(x.to)),
  }
}

export function behaviorFor(what) {
  const text = String(what || '')
  if (/睡|午睡|眯/.test(text)) return 'sleep'
  if (/走|路上|出发|去往|回宿舍|地铁|公交/.test(text)) return 'walk'
  // 宠物语境里的「吃」是猫在吃（「看它吃完半根火腿肠」），不是她在吃
  const watchingPet = /猫|狗|喂|看它|摸它|撸它/.test(text)
  if (!watchingPet && /吃饭|吃早饭|吃午饭|吃晚饭|吃面|吃零食|吃外卖|食堂|早餐|午饭|晚饭|奶茶/.test(text)) return 'eat'
  if (/上课|自习|背书|复习|看书|作业|课件|写稿|改稿|写作|码字|论文|画|剪片|修图/.test(text)) return 'study'
  if (/拍照|相机|自拍/.test(text)) return 'photo'
  if (/洗澡|洗漱/.test(text)) return 'bath'
  if (/手机|刷|游戏|B站|看剧/.test(text)) return 'phone'
  return 'idle'
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

function shortestRoute(world, from, to) {
  if (!from || !to || from === to) return { nodes: [from].filter(Boolean), minutes: 0, legs: [] }
  const graph = new Map(world.地点.map((node) => [node.id, []]))
  for (const edge of world.路径) {
    if (!graph.has(edge.from) || !graph.has(edge.to)) continue
    graph.get(edge.from).push({ to: edge.to, minutes: edge.minutes })
    graph.get(edge.to).push({ to: edge.from, minutes: edge.minutes })
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
      prev.set(edge.to, { from: current, minutes: edge.minutes })
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
    legs.unshift({ from: p.from, to: cursor, minutes: p.minutes })
    cursor = p.from
    nodes.unshift(cursor)
  }
  return { nodes, minutes: dist.get(to), legs }
}

/** Decorate timeline segments and reserve the final minutes before a location change for travel. */
export function addWorldToTimeline(timeline, worldConfig = defaultWorldConfig) {
  const world = normalizeWorldConfig(worldConfig)
  const rows = (timeline || []).map((item) => ({
    ...item,
    locationId: locationForNormalized(item.what, world),
    behavior: behaviorFor(item.what),
  })).sort((a, b) => a.start - b.start)
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
    const p = cursor / minutes
    return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }
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

