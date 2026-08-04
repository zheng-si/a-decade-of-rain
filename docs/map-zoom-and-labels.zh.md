# 地图缩放、图层与标注 —— Archive 探索器逐项审计（对照 CF）

把 Archive 地图上所有随缩放变化的东西逐项列出来，并把 Climate Mobility（下称 CF）
探索器放在旁边作参照。

英文版：[`map-zoom-and-labels.md`](./map-zoom-and-labels.md)（两份内容一致，以英文版为准）。

**溯源标记怎么读。** CF 的每一行都是三种之一：

- ● **从他们代码里读出来的** —— 从打包产物或存档页面里反编译出的字面值，不是推断。
- ◐ **推断** —— 根据代码隐含的逻辑推出来的，但代码没有直说。
- ○ **未知** —— 从存档里确实拿不到，如实标注，不猜。

我们自己的数字全部来自源码或浏览器实测；凡是实测而非声明的，表里都注明了。

**唯一的大缺口。** CF 的底图是一个远程 Mapbox Studio 样式（Explore 页用的是
`mapbox://styles/gccm/cl5rujhy3000415pny20an82b`，打包产物里另外引用了
`cl6qfxkxs00hk14pdm9md5380`）。样式 JSON 是运行时拉取的，**不在**存档页面里。这一点我
验证过：他们 JS 里所有 `text-size`、`text-field`、`symbol` 字符串，全部属于打包进去的
mapbox-gl 库本身，而不是 CF 自己的代码。**CF 一行 label 规则都没写在代码里** —— 全在
Studio 里，我们看不到。所以 CF 的每一条 label 行都是 ○，如实标注。

---

## 1 · 缩放范围与层级数量

| | A Decade of Rain（Archive） | CF（Explore） |
|---|---|---|
| 缩放下限 | **按视口推导**：`fit(recordBounds) − 0.35` | ● 写死：`minZoom: y ? 3 : 1.5`（桌面 3，手机 1.5） |
| 缩放上限 | **12**（`view.maxZoom`） | ● **9**（`maxZoom: 9`） |
| 可用层级 | 约 5.6–6.4 级，随视口变化 | ● 桌面 6 级，手机 7.5 级 |
| 初始相机 | 容器拿到真实尺寸后 fit 到 `recordBounds` | ● `initialViewState` 来自 CMS；存档快照当时在 z5.87 |
| 平移夹取 | `maxBounds` `[[94,2],[122,26]]` | ○ 打包产物里没找到 |
| resize 重新取景 | 有，防抖 120 ms，且**只在读者没移动过时**才重置 | ● 每次 resize 都 `flyTo(initialCenter, initialZoom)`，防抖 50 ms —— **无条件**，会把读者拽回去 |

真实浏览器实测的 home 缩放与下限，`recordBounds` = `[[103.8, 8.3], [109.8, 17.7]]`：

| 视口 | home z | minZoom | 可见南北范围 |
|---|---|---|---|
| 390×844（iPhone 14） | 5.29 | 4.94 | 5.57–20.30 °N |
| 834×1112（iPad） | 5.48 | 5.13 | 4.42–21.38 °N |
| 1280×800（13″） | 5.76 | 5.41 | 7.94–18.05 °N |
| 1512×900（16″） | 5.94 | 5.59 | 7.98–18.01 °N |
| 1920×1080 | 6.22 | 5.87 | 8.04–17.95 °N |
| 2560×1440（27″） | 6.65 | 6.30 | 8.11–17.89 °N |

最小视口和最大视口之间差 1.36 级。这就是「下限要推导而不是写死」的理由：任何单一数字在
两端都是错的。CF 选了相反的做法，接受手机和桌面开场取景不同。

---

## 2 · 数据层级（LOD）

我们 —— 三层，两个换挡点，在 `mapConfig.ts` 里声明为 `Z_MID` / `Z_NEAR`：

| 层级 | 图层 | 缩放区间 | 网格边长 | 半径 `k·√gallons` | 上限 |
|---|---|---|---|---|---|
| 远 | `vol-coarse-l` | 下限 → **7.0** | 0.12°（约 13 km） | z5.6 → 0.030，z7.0 → 0.069 | 13 px |
| 中 | `vol-fine-l` | **7.0** → **9.2** | 0.03°（约 3 km） | z7.0 → 0.037，z9.2 → 0.100 | 12 px |
| 近 | `vol-raw` | **9.2** → 12 | 无（原始架次） | z9.2 → 0.14，z12 → 0.34 | 18 px |

CF —— ● 两层，一个换挡点在 **z7**：

```js
minzoom: id.includes("low")  ? 0 : id.includes("high") ? 7 : 0
maxzoom: id.includes("low")  ? 7 : 24
```

| 层级 | 数据源 | 缩放区间 |
|---|---|---|
| low | `gccm.acmi_2022_mobility_{unit}_low` | 0 → 7 |
| high | `gccm.acmi_2022_mobility_{unit}_high` | 7 → 24 |

两层是**同时挂载**的 —— ● 他们的 `activeLayers` 过滤条件是 rcp/ssp/unit/timePeriod，
**不含** resolution，所以 LOD 切换完全靠 `minzoom`/`maxzoom`，从不切 visibility。
机制和我们一样。

值得一提：**CF 的换挡点是 z7，我们的第一个换挡点是 z7.0。** 各自独立得出的。

CF 还有一处 ● 细节：`"fill-antialias": zoom > 5 && layerId !== "sea_level_rise_ssp1"` ——
z5 以下关抗锯齿换性能，且对其中一个图层永久关闭。

---

## 3 · 底图图层显隐 —— positron 的全部图层

把真实的 `quietBasemap` + `applyMapTheme` 规则跑在线上 positron 样式 JSON（55 个图层）
上导出的结果。「原生 z」是 positron 自己的区间。

| 图层 | 类型 | 原生 z | 我们的处理 |
|---|---|---|---|
| `background` | background | 0–24 | → `land` #f3f1ed |
| `park` | fill | 0–24 | → `greenspace` #e1e5d7 |
| `water` | fill | 0–24 | → #d1dee6 |
| `landcover_ice_shelf` | fill | 0–8 | → greenspace（越南用不到） |
| `landcover_glacier` | fill | 0–8 | → greenspace（越南用不到） |
| `landuse_residential` | fill | 0–16 | → greenspace ⚠️ 见 §7.5 |
| `landcover_wood` | fill | 10–24 | → greenspace |
| `waterway` | line | 0–24 | → #c0d0db |
| `building` | fill | 12–24 | **隐藏** |
| `tunnel_motorway_*` | line | 6–24 | 保留，发丝线 0.4→2 px |
| `aeroway-taxiway` | line | 12–24 | **未处理** ⚠️ |
| `aeroway-runway-casing` | line | 11–24 | **未处理** ⚠️ |
| `aeroway-area` | fill | 4–24 | **未处理** ⚠️ |
| `aeroway-runway` | line | 11–24 | **未处理** ⚠️ |
| `road_area_pier` | fill | 0–24 | **未处理** |
| `road_pier` | line | 0–24 | **隐藏**（次级道路） |
| `highway_path` | line | 0–24 | **隐藏**（次级道路） |
| `highway_minor` | line | 8–24 | **隐藏**（次级道路） |
| `highway_major_casing` / `_inner` | line | 11–24 | 保留，发丝线 |
| `highway_major_subtle` | line | 0–11 | 保留，发丝线 |
| `highway_motorway_casing` / `_inner` | line | 6–24 | 保留，发丝线 |
| `highway_motorway_subtle` | line | 0–6 | 保留，发丝线 |
| `highway_motorway_bridge_*` | line | 6–24 | 保留，发丝线 |
| `railway*`（6 个图层） | line | 13–24 | 未处理 —— 超过 maxZoom 12，永远画不出来 |
| `boundary_3` | line | 8–24 | 保留，仅 `admin_level ≤ 4` |
| `boundary_2` | line | 0–24 | 保留，仅 `admin_level ≤ 4` |
| `boundary_disputed` | line | 0–24 | 保留，仅 `admin_level ≤ 4` |

CF：○ 他们的底图图层集合完全在 Studio 样式里。唯一能确定的是 ● 他们的数据填充是用
`beforeId: "country labels disputed"` 插入的 —— 所以**他们底图里的每一个标注都画在数据
之上**，而且他们样式里确实存在一个叫这个名字的图层。

---

## 4 · 标注图层 —— 显隐与缩放分级

这是最该逐行看的一张表。

| 图层 | 原生 z | 我们的夹取 | 字号 ramp | 备注 |
|---|---|---|---|---|
| `label_country_1/2/3` | 0–9 / 0–9 / 2–9 | **0 → 7.0** | 12.5 → 15 | 越南被过滤掉（我们自己画） |
| `label_city_capital` | 3–24 | **无** | 9.5 → 14 | 开场视图就在 |
| `label_city` | 3–24 | **无** | 9.5 → 14 | 开场视图就在 |
| `label_town` | 6–24 | **7.0 → 22** | 9.5 → 14 | 第一个换挡点才出现 |
| `label_other` | 8–24 | **无** ⚠️ | 9.5 → 14 | 无人管理的第三档聚落 —— 见 §7.2 |
| `label_state` | 5–8 | **隐藏** | — | 省界会和军区分区打架 |
| `label_village` | 9–24 | **隐藏** | — | 改制后 OSM 里全是「P.9」这类名字 |
| `water_name_point_label` | 0–24 | 无 | 9.5 → 14 | 走 `name:en` 显示英文，颜色 #44585e |
| `water_name_line_label` | 0–24 | 无 | 9.5 → 14 | 同上 |
| `waterway_line_label` | 10–24 | 无 | 9.5 → 14 | 同上 |
| `airport` | 11–24 | **无** ⚠️ | 9.5 → 14 | z11–12 会画出来 —— 见 §7.3 |
| `highway-shield-non-us` | 11–24 | **无** ⚠️ | 9.5 → 14 | z11–12 画出来，盾牌图标被剥掉，只剩光秃秃的路号 |
| `road_shield_us` | 12–24 | **无** ⚠️ | 9.5 → 14 | z12 画出来 |
| `highway-shield-us-interstate` | 11–24 | **隐藏** ⚠️ | — | **误伤**隐藏 —— 见 §7.1 |
| `highway-name-major` | 12.2–24 | 无 | 9.5 → 14 | 超过 maxZoom 12，永远画不出来 |
| `highway-name-minor` | 15–24 | 无 | 9.5 → 14 | 永远画不出来 |
| `highway-name-path` | 15.5–24 | 无 | 9.5 → 14 | 永远画不出来 |

所有活下来的标注图层统一处理：大写、字距 0.2、字体 `Roboto Condensed`、
描边 `rgba(250,249,244,0.92)` 1.1 px、剥掉图标、`text-anchor: center`、
`text-offset: [0,0]`，以及

```js
symbol-sort-key: ['case', ['has','rank'], ['to-number',['get','rank']], 100]
```

让碰撞按 OpenMapTiles 的 rank 决胜，而不是按瓦片顺序碰运气。

CF：○ 全部未知。从存档里拿不到。

---

## 5 · 我们自己的标注层

| 图层 | 缩放区间 | 字号 ramp | 颜色 | 备注 |
|---|---|---|---|---|
| `mr-label`（MILITARY REGION I–IV） | 0 → **9.2** | 12 → 16 | #cf3720，描边 2 px | 在第二个换挡点退场 |
| `mr-borders` | 0 → 24 | — | #ec7066，虚线 2.4/1.8，1.2 px @ 0.55 | 从不夹取 |
| `vn-label`（VIET NAM） | 0 → **7.0** | 12.5 → 15 | #4b5a50 | 与国家档完全对齐 |
| `island-label`（西沙/南沙） | 0 → 24 | 8.5 → 11 | #6b7268 | 每个缩放级别上最安静的一档 |

---

## 6 · 标注字号随缩放的变化

一条线性 ramp，锚点 `Z_TYPE_FLOOR = 5` → `Z_TYPE_TOP = 12`：

```js
['interpolate', ['linear'], ['zoom'], 5, atFloor, 12, atTop]
```

在几个关键缩放级上的实际像素值（16″ 笔记本 home = 5.94）：

| 档位 | ramp | @home 5.94 | @Z_MID 7.0 | @Z_NEAR 9.2 | @max 12 |
|---|---|---|---|---|---|
| 国家 / VIET NAM | 12.5 → 15 | **12.84** | 13.21 *（退场）* | — | — |
| 军区 | 12 → 16 | **12.54** | 13.14 | 14.40 *（退场）* | — |
| 城市 / 城镇 / 水域 | 9.5 → 14 | **10.10** | 10.79 | 12.20 | 14.00 |
| 岛屿 | 8.5 → 11 | **8.84** | 9.21 | 10.00 | 11.00 |

刻意做成一条没有中间停靠点的直线：真正换挡的两个点（`Z_MID`、`Z_NEAR`）改变的是
*屏幕上有什么*，而不是它有多大。

⚠️ ramp 锚在 z5，但**没有任何视口从那里开始** —— 实测 home 缩放是 5.29–6.65。也就是说
读者永远是在 ramp 的 0.3–1.65 级处遇见这张地图，`atFloor` 是一个谁也看不到的值。
见 §7.4。

CF：○ 未知 —— 在 Studio 那边。

---

## 7 · 做这张表时发现的问题

按我认为的重要程度排序。**一个都没改**，这些是你来定的。

**7.1 · `highway-shield-us-interstate` 是被误伤隐藏的。**
省份规则是 `/state|province/.test(id)`，而 `inter`**`state`** 匹配上了。这个图层确实
该消失，但理由是错的 —— 正则匹配的是子串，不是词。在越南无害；但下一个动这条正则的人
会踩坑。

**7.2 · `label_other` 是一档没人管的聚落。**
分级方案设计的是*开场显示城市 → z7 显示城镇*，但 positron 还有一个 `label_other`
（原生 z8），没有任何规则夹取它。实际顺序是：城市（始终）→ 城镇（z7）→ other（z8）。
要么并进城镇的夹取区间，要么隐藏 —— 现在它比城镇晚一级出现，而这不是任何人选的。

**7.3 · 路盾和机场标注活到了 z11–12。**
`highway-shield-non-us`（z11）、`road_shield_us`（z12）和 `airport`（z11）都带
`text-field`，所以「仅图标」那条规则漏掉了它们，它们拿到了完整的地名处理 —— 大写、
加字距、Roboto Condensed。路盾我们还剥掉了 `icon-image`，结果是一个没有盾牌包裹的
光秃秃路号飘在那里。只在最高一级缩放可见 —— 但那恰好是原始架次层最需要被看清的地方。

**7.4 · 字号 ramp 的锚点低于所有真实起始缩放。**
`Z_TYPE_FLOOR = 5`，而实测是 5.29–6.65。这不算 bug —— ramp 是连续的 —— 但注释里说
z5 是「读者遇见地图时的字号」是错的；而且如果你想调开场字号，你现在是在通过一个外推值
调它。把 ramp 锚到约 5.3，`atFloor` 才名副其实。

**7.5 · `landuse_residential` 被涂成了植被色。**
`classify()` 把任何匹配 `landuse` 的都归到 `greenspace`，所以住宅用地拿到了 #e1e5d7 ——
和 `landcover_wood` 一模一样。在一张主题是*森林曾经在哪*的地图上，建成区和森林现在
长得完全一样。positron 从 0 画到 16，也就是我们允许的每一个缩放级上它都在。

**7.6 · `aeroway-*` 两个 pass 都没碰。**
跑道和滑行道在 z11–12 会用 positron 的原色画出来。考虑到主题是空中喷洒作战，机场
**很可能是想要的** —— 但现在它们在那儿是因为漏了，不是因为选了。

**7.7 · CF 的 resize 会把读者拽回原点。**
● 每次 resize 都无条件 `flyTo({center: initialCenter, zoom: initialZoom})`。手机转个屏
就丢失当前位置。我们只在 `isAtHome()` 判定读者没移动过时才重新取景。写下来是因为这是
少数几个对比明显对我们有利的地方之一。

---

## 8 · 交互与控件

| | 我们 | CF |
|---|---|---|
| 缩放按钮 | `NavigationControl`，右下角，无罗盘 | ● **没有** —— 在存档 DOM 里逐个查过，确认不存在 |
| 罗盘 | 关 | ● 无 |
| 比例尺 | 自定义，在图例面板里 | ● 无 |
| 滚轮 / 双指缩放 | 默认开 | ● 默认开 |
| 倾斜 | Flat/3D 切换，`pitch3d: 55°`，`maxPitch: 68°` | ○ 没找到 pitch 相关 UI |
| 版权信息 | 紧凑模式 | ● Mapbox 标准 |

---

## 9 · 你可能想改的数值一览

| 旋钮 | 位置 | 当前值 |
|---|---|---|
| 缩放上限 | `mapConfig.view.maxZoom` | 12 |
| 缩放下限余量 | `mapConfig.view.minZoomMargin` | 比 fit 低 0.35 |
| 兜底下限 | `mapConfig.view.minZoom` | 5.6（仅在 fit 失败时用） |
| 取景范围 | `mapConfig.view.recordBounds` | `[[103.8, 8.3], [109.8, 17.7]]` |
| 取景内边距 | `mapConfig.view.fitPadding` | 28 px |
| 第一换挡点 | `mapConfig.Z_MID` | 7.0 |
| 第二换挡点 | `mapConfig.Z_NEAR` | 9.2 |
| 粗网格边长 | `volumeGrid.COARSE_DEG` | 0.12° |
| 细网格边长 | `volumeGrid.FINE_DEG` | 0.03° |
| 字号 ramp 两端 | `mapTheme.Z_TYPE_FLOOR` / `Z_TYPE_TOP` | 5 / 12 |
| 地名字号 | `quietBasemap` | 9.5 → 14 |
| 国家字号 | `COUNTRY_TEXT.size` | 12.5 → 15 |
| 军区标签字号 | `addMilitaryRegions` | 12 → 16 |
| 岛屿注记字号 | `addIslandMarks` | 8.5 → 11 |
