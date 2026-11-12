import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const input = resolve(process.argv[2] || '')
if (!process.argv[2]) throw new Error('usage: node scripts/build-xueyuan-map.mjs <xueyuan-road.osm>')

const outputDir = resolve('assets/maps')
const xml = readFileSync(input, 'utf8')
const width = 1000
const height = 560
const bbox = { minLon: 116.3365, maxLon: 116.3480, minLat: 39.9935, maxLat: 39.9995 }
const attrs = (source) => Object.fromEntries([...source.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))
const tagsOf = (body) => Object.fromEntries([...body.matchAll(/<tag k="([^"]+)" v="([^"]*)"\/>/g)].map((m) => [m[1], m[2]]))
const escapeXml = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

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
const centroid = (points) => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, points.length),
  y: points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, points.length),
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
const namedBuildings = new Set(['矿大图书馆', '综合楼', '教学楼', '裕园餐厅', '体育馆', '理化楼', '科技楼', '矿大交流中心', '学生公寓10号楼', '矿大体育场'])
const svgOpen = (label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">`

const campusPath = campus ? line(pointsOf(campus), true) : ''
const majorRoads = roads.filter((way) => majorHighways.has(way.tags.highway))
const minorRoads = roads.filter((way) => !majorHighways.has(way.tags.highway) && !walkHighways.has(way.tags.highway))
const walkRoads = roads.filter((way) => walkHighways.has(way.tags.highway))

const baseSvg = `${svgOpen('学院路真实地图底层')}
  <rect width="1000" height="560" fill="#dfe5de"/>
  ${campusPath ? `<path d="${campusPath}" fill="#e9eee6" stroke="#788a82" stroke-width="2"/>` : ''}
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${minorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#bcc5bd" stroke-width="5"/>`).join('')}
    ${majorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#aeb9b2" stroke-width="16"/>`).join('')}
    ${majorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#d9ded9" stroke-width="11"/>`).join('')}
    ${walkRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#c5cec6" stroke-width="2" stroke-dasharray="3 4"/>`).join('')}
  </g>
  <g font-family="system-ui,sans-serif" font-size="14" fill="#687870" font-weight="600">
    <text x="890" y="315" transform="rotate(88 890 315)">学院路</text>
    <text x="48" y="22">清华东路</text>
  </g>
</svg>`

const animeSvg = `${svgOpen('学院路二次元渲染中层')}
  <defs>
    <linearGradient id="campus" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e9f3dc"/><stop offset="1" stop-color="#d9ede1"/></linearGradient>
    <linearGradient id="pitch" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b9dbad"/><stop offset="1" stop-color="#8fc6a0"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b5e5df"/><stop offset="1" stop-color="#79bac7"/></linearGradient>
  </defs>
  ${campusPath ? `<path d="${campusPath}" fill="url(#campus)" stroke="#fff" stroke-opacity=".72" stroke-width="4"/>` : ''}
  <g fill="url(#pitch)" fill-opacity=".72" stroke="#75a881" stroke-opacity=".32" stroke-width="1.5">
    ${greenAreas.map((way) => `<path d="${line(pointsOf(way), true)}"/>`).join('')}
  </g>
  <g fill="url(#water)" fill-opacity=".78" stroke="#fff" stroke-opacity=".7" stroke-width="3">
    ${waters.map((way) => `<path d="${line(pointsOf(way), true)}"/>`).join('')}
  </g>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${majorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#fff8dc" stroke-width="10" opacity=".9"/>`).join('')}
    ${minorRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#fffbed" stroke-width="4" opacity=".72"/>`).join('')}
    ${walkRoads.map((way) => `<path d="${line(pointsOf(way))}" stroke="#7daa8b" stroke-width="1.5" stroke-dasharray="4 5" opacity=".58"/>`).join('')}
  </g>
  <g fill="#7aab72" opacity=".55">
    <circle cx="346" cy="108" r="5"/><circle cx="362" cy="102" r="7"/><circle cx="379" cy="111" r="5"/>
    <circle cx="642" cy="447" r="6"/><circle cx="659" cy="441" r="8"/><circle cx="677" cy="449" r="5"/>
  </g>
</svg>`

const buildingPaths = buildings.map((way) => ({ way, points: pointsOf(way), d: line(pointsOf(way), true) })).filter((item) => item.d)
const labels = buildingPaths.flatMap(({ way, points }) => {
  const name = way.tags.name
  if (!name || !namedBuildings.has(name)) return []
  const point = centroid(points)
  const label = name === '学生公寓10号楼' ? '学生公寓' : name
  return [`<text x="${point.x.toFixed(1)}" y="${(point.y + 3).toFixed(1)}">${escapeXml(label)}</text>`]
})
const buildingsSvg = `${svgOpen('学院路建筑上层')}
  <g fill="#698173" opacity=".18" transform="translate(3 5)">${buildingPaths.map(({ d }) => `<path d="${d}"/>`).join('')}</g>
  <g fill="#f0d7bd" stroke="#fff8ec" stroke-width="2">${buildingPaths.map(({ way, d }) => `<path d="${d}"${namedBuildings.has(way.tags.name) ? ' fill="#dcae8b"' : ''}/>`).join('')}</g>
  <g font-family="system-ui,'PingFang SC',sans-serif" font-size="9" text-anchor="middle" fill="#4c5d54" font-weight="650" paint-order="stroke" stroke="#fffaf0" stroke-width="3" stroke-linejoin="round">${labels.join('')}</g>
</svg>`

mkdirSync(outputDir, { recursive: true })
for (const [name, content] of [['xueyuan-base.svg', baseSvg], ['xueyuan-anime.svg', animeSvg], ['xueyuan-buildings.svg', buildingsSvg]]) {
  const target = resolve(outputDir, name)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}
console.log(`wrote ${outputDir} from OpenStreetMap bbox ${Object.values(bbox).join(',')}`)
