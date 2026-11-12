import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const input = resolve(process.argv[2] || '')
if (!process.argv[2]) throw new Error('usage: node scripts/build-xueyuan-map.mjs <xueyuan-road.osm>')

const outputDir = resolve('assets/maps')
const xml = readFileSync(input, 'utf8')
const width = 1000
const height = 560
const bbox = { minLon: 116.3355, maxLon: 116.3490, minLat: 39.9905, maxLat: 40.0015 }
const attrs = (source) => Object.fromEntries([...source.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))
const tagsOf = (body) => Object.fromEntries([...body.matchAll(/<tag k="([^"]+)" v="([^"]*)"\/>/g)].map((m) => [m[1], m[2]]))

const nodes = new Map()
for (const match of xml.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
  const attr = attrs(match[1])
  nodes.set(attr.id, { id: attr.id, lat: Number(attr.lat), lon: Number(attr.lon), tags: tagsOf(match[2] || '') })
}

const ways = []
for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
  const attr = attrs(match[1])
  ways.push({
    id: attr.id,
    refs: [...match[2].matchAll(/<nd ref="(\d+)"\/>/g)].map((m) => m[1]),
    tags: tagsOf(match[2]),
  })
}

const project = ({ lon, lat }) => ({
  x: (lon - bbox.minLon) / (bbox.maxLon - bbox.minLon) * width,
  y: (bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat) * height,
})
const pointsOf = (way) => way.refs.map((id) => nodes.get(id)).filter(Boolean).map(project)
const visible = (points) => points.some((p) => p.x > -80 && p.x < width + 80 && p.y > -80 && p.y < height + 80)
const line = (points, close = false) => points.length < 2 ? '' : `M${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}${close ? 'Z' : ''}`
const isArea = (way) => way.refs.length > 2 && way.refs[0] === way.refs.at(-1)
const geoCentroid = (way) => {
  const points = way.refs.map((id) => nodes.get(id)).filter(Boolean)
  if (!points.length) throw new Error(`way ${way.id} has no nodes`)
  return {
    lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length,
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
  }
}
const percent = (point) => {
  const projected = project(point)
  return { x: projected.x / width * 100, y: projected.y / height * 100 }
}
const distanceMeters = (a, b) => {
  const dy = (a.lat - b.lat) * 111320
  const dx = (a.lon - b.lon) * 111320 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180)
  return Math.hypot(dx, dy)
}

const wayById = (id) => ways.find((way) => way.id === String(id))
const nodeById = (id) => nodes.get(String(id))
const nodeByName = (name) => [...nodes.values()].find((node) => node.tags.name === name)
const seedFromWay = (id) => geoCentroid(wayById(id) || (() => { throw new Error(`missing OSM way ${id}`) })())
const seedFromNode = (id, fallbackName) => {
  const node = nodeById(id) || nodeByName(fallbackName)
  if (!node) throw new Error(`missing OSM node ${id} (${fallbackName})`)
  return { lon: node.lon, lat: node.lat }
}

// POIs are resolved from stable OSM objects, then routing snaps them onto the
// largest connected walking graph. The displayed point remains the real POI.
const locationSeeds = {
  dorm: seedFromWay('247351731'),
  classroom: seedFromWay('247351554'),
  library: seedFromWay('247351547'),
  canteen: seedFromWay('247351575'),
  shop: seedFromNode('', '幸福超市'),
  outdoor: seedFromNode('1360087364', ''),
  cafe: seedFromNode('2783311652', '上岛咖啡'),
  mall: seedFromWay('154079919'),
  mcdonalds: seedFromNode('875454417', '麦当劳'),
}

const routableHighways = new Set([
  'footway', 'path', 'pedestrian', 'cycleway', 'steps', 'living_street',
  'residential', 'service', 'unclassified', 'tertiary', 'secondary', 'primary',
])
const routingGraph = new Map()
const connect = (from, to, meters) => {
  if (!routingGraph.has(from)) routingGraph.set(from, [])
  routingGraph.get(from).push({ to, meters })
}
for (const way of ways) {
  if (!routableHighways.has(way.tags.highway) || way.tags.highway === 'construction') continue
  for (let i = 1; i < way.refs.length; i++) {
    const a = nodes.get(way.refs[i - 1])
    const b = nodes.get(way.refs[i])
    if (!a || !b) continue
    const inside = (point) => point.lon >= bbox.minLon - .001 && point.lon <= bbox.maxLon + .001
      && point.lat >= bbox.minLat - .001 && point.lat <= bbox.maxLat + .001
    if (!inside(a) || !inside(b)) continue
    const meters = distanceMeters(a, b)
    connect(a.id, b.id, meters)
    connect(b.id, a.id, meters)
  }
}

const components = []
const unseen = new Set(routingGraph.keys())
while (unseen.size) {
  const first = unseen.values().next().value
  const component = new Set([first])
  const stack = [first]
  unseen.delete(first)
  while (stack.length) {
    const current = stack.pop()
    for (const edge of routingGraph.get(current) || []) {
      if (!unseen.has(edge.to)) continue
      unseen.delete(edge.to)
      component.add(edge.to)
      stack.push(edge.to)
    }
  }
  components.push(component)
}
const walkingComponent = components.sort((a, b) => b.size - a.size)[0] || new Set()
const nearestRoutingNode = (point) => {
  let best = null
  let bestDistance = Infinity
  for (const id of walkingComponent) {
    const candidate = nodes.get(id)
    const meters = distanceMeters(point, candidate)
    if (meters >= bestDistance) continue
    best = id
    bestDistance = meters
  }
  if (!best) throw new Error('walking graph is empty')
  return best
}
const routeAnchors = Object.fromEntries(Object.entries(locationSeeds).map(([id, point]) => [id, nearestRoutingNode(point)]))

const shortestWalkingPath = (from, to) => {
  const start = routeAnchors[from]
  const target = routeAnchors[to]
  const dist = new Map([[start, 0]])
  const prev = new Map()
  const open = new Set([start])
  while (open.size) {
    let current = null
    for (const id of open) if (current === null || dist.get(id) < dist.get(current)) current = id
    open.delete(current)
    if (current === target) break
    for (const edge of routingGraph.get(current) || []) {
      if (!walkingComponent.has(edge.to)) continue
      const next = dist.get(current) + edge.meters
      if (next >= (dist.get(edge.to) ?? Infinity)) continue
      dist.set(edge.to, next)
      prev.set(edge.to, current)
      open.add(edge.to)
    }
  }
  if (!dist.has(target)) throw new Error(`no walking route from ${from} to ${to}`)
  const ids = [target]
  while (ids[0] !== start) ids.unshift(prev.get(ids[0]))
  return { ids, meters: dist.get(target) }
}

const pointLineDistance = (point, a, b) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (!dx && !dy) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}
const simplify = (points, epsilon = .28) => {
  if (points.length <= 2) return points
  let maxDistance = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const distance = pointLineDistance(points[i], points[0], points.at(-1))
    if (distance > maxDistance) { maxDistance = distance; index = i }
  }
  if (maxDistance <= epsilon) return [points[0], points.at(-1)]
  return [...simplify(points.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(points.slice(index), epsilon)]
}
const trimRoutePoints = (points, limit = 30) => {
  if (points.length <= limit) return points
  return Array.from({ length: limit }, (_, index) => points[Math.round(index * (points.length - 1) / (limit - 1))])
}
const routePairs = [
  ['dorm', 'canteen'], ['dorm', 'library'], ['dorm', 'classroom'],
  ['canteen', 'library'], ['classroom', 'library'], ['canteen', 'shop'],
  ['library', 'shop'], ['shop', 'outdoor'], ['classroom', 'cafe'],
  ['outdoor', 'cafe'], ['cafe', 'mall'], ['outdoor', 'mcdonalds'],
]
const generatedLocations = Object.fromEntries(Object.entries(locationSeeds).map(([id, point]) => {
  const p = percent(point)
  return [id, { x: Number(p.x.toFixed(1)), y: Number(p.y.toFixed(1)) }]
}))
const generatedPaths = routePairs.map(([from, to]) => {
  const route = shortestWalkingPath(from, to)
  const points = route.ids.map((id) => percent(nodes.get(id)))
  const via = trimRoutePoints(simplify(points)).map((point) => ({ x: Number(point.x.toFixed(1)), y: Number(point.y.toFixed(1)) }))
  return { from, to, minutes: Math.max(2, Math.round(route.meters / 75)), via }
})

const campus = ways.find((way) => way.id === '1003833559')
const buildings = ways.filter((way) => way.tags.building && isArea(way) && visible(pointsOf(way)))
const roads = ways.filter((way) => way.tags.highway && visible(pointsOf(way)))
const greenAreas = ways.filter((way) => isArea(way) && visible(pointsOf(way)) && (
  ['grass', 'forest', 'meadow', 'recreation_ground'].includes(way.tags.landuse)
  || ['park', 'garden', 'pitch', 'stadium', 'track'].includes(way.tags.leisure)
  || ['wood', 'grassland'].includes(way.tags.natural)
))
const waters = ways.filter((way) => isArea(way) && visible(pointsOf(way)) && (
  way.tags.natural === 'water' || way.tags.water || way.tags.leisure === 'swimming_pool'
))

const majorHighways = new Set(['primary', 'primary_link', 'secondary', 'tertiary'])
const walkHighways = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps'])
const highlightedBuildings = new Set(['矿大图书馆', '综合楼', '教学楼', '裕园餐厅', '体育馆', '理化楼', '科技楼', '矿大交流中心', '学生公寓10号楼', '矿大体育场'])
const svgOpen = (label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">`

const campusPath = campus ? line(pointsOf(campus), true) : ''
const majorRoads = roads.filter((way) => majorHighways.has(way.tags.highway))
const minorRoads = roads.filter((way) => !majorHighways.has(way.tags.highway) && !walkHighways.has(way.tags.highway))
const walkRoads = roads.filter((way) => walkHighways.has(way.tags.highway))
const animeTrees = [
  [116.3393, 39.9990, 25], [116.3400, 39.9979, 22], [116.3408, 39.9987, 19], [116.3422, 39.9979, 23],
  [116.3430, 39.9977, 18], [116.3449, 39.9977, 22], [116.3456, 39.9968, 19], [116.3462, 39.9958, 23],
  [116.3447, 39.9953, 18], [116.3430, 39.9953, 21], [116.3418, 39.9953, 18], [116.3400, 39.9955, 21],
].map(([lon, lat, size]) => ({ ...project({ lon, lat }), size }))
const animeBushes = [
  [116.3395, 39.9988], [116.3404, 39.9978], [116.3425, 39.9975], [116.3440, 39.9976],
  [116.3453, 39.9969], [116.3457, 39.9957], [116.3438, 39.9952], [116.3410, 39.9954],
].map(([lon, lat]) => project({ lon, lat }))
const baseSvg = `${svgOpen('学院路真实地图底层')}
  <rect width="1000" height="560" fill="#dfe5de"/>
  ${campusPath ? `<path d="${campusPath}" fill="#e9eee6" stroke="#788a82" stroke-width="2"/>` : ''}
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${minorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#bcc5bd" stroke-width="5"/>`).join('')}
    ${majorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#aeb9b2" stroke-width="16"/>`).join('')}
    ${majorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#d9ded9" stroke-width="11"/>`).join('')}
    ${walkRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#c5cec6" stroke-width="2" stroke-dasharray="3 4"/>`).join('')}
  </g>
</svg>`

const animeSvg = `${svgOpen('学院路二次元渲染中层')}
  <defs>
    <linearGradient id="campus" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f2f6d8"/><stop offset=".46" stop-color="#dff0d5"/><stop offset="1" stop-color="#cfe9df"/></linearGradient>
    <linearGradient id="pitch" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c5e7a8"/><stop offset="1" stop-color="#83c89d"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b5e5df"/><stop offset="1" stop-color="#79bac7"/></linearGradient>
    <pattern id="paper" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1" fill="#5e9b73" opacity=".12"/><path d="M12 14l3-2" stroke="#fff" stroke-width="1" opacity=".24"/></pattern>
    <pattern id="field" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 22L22 0M-6 6L6-6M16 28L28 16" stroke="#fff" stroke-width="2" opacity=".18"/></pattern>
    <symbol id="tree" viewBox="0 0 36 42">
      <path d="M16 29h5l2 11h-9z" fill="#9b7558"/>
      <circle cx="12" cy="20" r="10" fill="#70ad74"/><circle cx="24" cy="19" r="10" fill="#589b70"/><circle cx="18" cy="11" r="11" fill="#8fc57a"/>
      <circle cx="14" cy="8" r="3" fill="#dff3b8" opacity=".72"/>
    </symbol>
    <symbol id="bush" viewBox="0 0 42 20"><circle cx="10" cy="12" r="8" fill="#7bbd84"/><circle cx="21" cy="8" r="9" fill="#91cb7d"/><circle cx="32" cy="12" r="8" fill="#62aa7c"/><circle cx="19" cy="5" r="2" fill="#fff2ae"/></symbol>
  </defs>
  ${campusPath ? `<path d="${campusPath}" fill="url(#campus)" stroke="#fffaf0" stroke-width="7"/>` : ''}
  ${campusPath ? `<path d="${campusPath}" fill="url(#paper)" stroke="#69a17d" stroke-opacity=".56" stroke-width="2"/>` : ''}
  <g fill="url(#pitch)" fill-opacity=".92" stroke="#5f9f74" stroke-opacity=".50" stroke-width="2.5">
    ${greenAreas.map((way) => `<path d="${line(pointsOf(way), true)}"/>`).join('')}
  </g>
  <g fill="url(#field)" opacity=".78">${greenAreas.map((way) => `<path d="${line(pointsOf(way), true)}"/>`).join('')}</g>
  <g fill="url(#water)" fill-opacity=".78" stroke="#fff" stroke-opacity=".7" stroke-width="3">
    ${waters.map((way) => `<path d="${line(pointsOf(way), true)}"/>`).join('')}
  </g>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${majorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#70a68b" stroke-width="14" opacity=".36"/>`).join('')}
    ${majorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#fff2c9" stroke-width="9" opacity=".96"/>`).join('')}
    ${minorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#77aa8c" stroke-width="7" opacity=".28"/>`).join('')}
    ${minorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#fff8dc" stroke-width="4" opacity=".92"/>`).join('')}
    ${walkRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#4f997a" stroke-width="2" stroke-dasharray="4 5" opacity=".72"/>`).join('')}
  </g>
  <g opacity=".92">
    ${animeTrees.map(({ x, y, size }) => `<use href="#tree" x="${(x - size / 2).toFixed(1)}" y="${(y - size).toFixed(1)}" width="${size}" height="${(size * 42 / 36).toFixed(1)}"/>`).join('')}
    ${animeBushes.map(({ x, y }) => `<use href="#bush" x="${(x - 18).toFixed(1)}" y="${(y - 8).toFixed(1)}" width="36" height="17"/>`).join('')}
  </g>
  <g fill="#fff4ad" stroke="#e2a7a1" stroke-width="1" opacity=".86">
    <circle cx="347" cy="188" r="3"/><circle cx="357" cy="182" r="2"/><circle cx="641" cy="326" r="3"/><circle cx="650" cy="321" r="2"/><circle cx="247" cy="306" r="2.5"/>
  </g>
</svg>`

const buildingPaths = buildings.map((way) => ({ way, d: line(pointsOf(way), true) })).filter((item) => item.d)
const buildingsSvg = `${svgOpen('学院路建筑上层')}
  <g fill="#698173" opacity=".18" transform="translate(3 5)">${buildingPaths.map(({ d }) => `<path d="${d}"/>`).join('')}</g>
  <g fill="#f0d7bd" stroke="#fff8ec" stroke-width="2">${buildingPaths.map(({ way, d }) => `<path d="${d}"${highlightedBuildings.has(way.tags.name) ? ' fill="#dcae8b"' : ''}/>`).join('')}</g>
</svg>`

mkdirSync(outputDir, { recursive: true })
const worldModule = `// Generated from OpenStreetMap by scripts/build-xueyuan-map.mjs.\nexport const xueyuanGeometry = ${JSON.stringify({ bbox, locations: generatedLocations, paths: generatedPaths }, null, 2)}\n`
for (const [name, content] of [
  ['xueyuan-base.svg', baseSvg], ['xueyuan-anime.svg', animeSvg], ['xueyuan-buildings.svg', buildingsSvg], ['xueyuan-world.js', worldModule],
]) {
  const target = resolve(outputDir, name)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}
console.log(`wrote ${outputDir} from OpenStreetMap bbox ${Object.values(bbox).join(',')}`)
