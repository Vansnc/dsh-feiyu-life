# 学院路地图数据署名

`xueyuan-base.svg`、`xueyuan-anime.svg` 与 `xueyuan-buildings.svg` 基于 OpenStreetMap 数据生成，范围为中国矿业大学（北京）学院路校区及周边（约 `116.3365,39.9935,116.3480,39.9995`）。

- 数据来源：© OpenStreetMap contributors
- 许可：Open Database License (ODbL) 1.0
- 处理：裁切到项目范围，并将道路、绿地、水域和建筑轮廓重新着色、分层；未改变底层地理坐标关系
- 数据获取日期：2026-11-12

运行时地图右下角必须保留可见的 OpenStreetMap 署名。重新生成时执行：

```bash
node scripts/build-xueyuan-map.mjs /path/to/xueyuan-road.osm
```
