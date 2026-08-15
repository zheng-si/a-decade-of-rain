# TDC 2027 海报项目交接文档（A Decade of Rain — HERBS File）

> 本文档是海报项目从旧会话拆出的完整交接。新会话从这里继续，无需旧对话历史。
> 语言约定：用户用中文交流，回复用中文。

## 一、项目定位

- **目标**：Tokyo TDC 2027，类别 7（Poster B，数据/实验海报）。
- **形式**：A1 竖版三联（594×841mm），画布 2828×4000 px（1:√2）。
- **风格**：type-as-data —— 整张海报全部由排版的真实数据记录构成，无照片无插画无标题字。暖纸 #faf9f4，Courier Prime 等宽（400/700），纪实克制、非倡导。
- **数据源**：仓库内 `public/data/spray-tracks.json`（解密美军 HERBS File，Operation Ranch Hand 越南喷洒行动 1962–1971）。

## 二、关键数据事实（已多轮核验）

- 固定翼架次（tracks, gallons>0）：**7,047**；固定翼总加仑：**18,905,413**。
- tracks+marks 总加仑 19,490,688（marks=直升机/地面 585,275 gal，1,621 次）——三联只用固定翼口径。
- 各药剂固定翼加仑：O 12,066,841 / W 5,430,462 / B 1,252,539 / P 500,017 / X(U+K) 240,829。
- 各药剂架次：O 4,138 / W 1,746 / B 700 / P 339 / X 124。
- 喷洒日期范围 **1962-02-15 → 1971-12-28**（5 条 1961 记录 gallons=0，正确排除；页脚一律写 1962–1971，en-dash U+2013）。
- 十年弧线：1962–64 纯紫 → 1965 橙剂涌入 → 1966–69 橙洪峰（白剂攀升）→ 1970 蓝剂增多（橙剂 1970-04 停用）→ 1971 橙剂归零、白/蓝收尾。

## 三、设计系统（三联共用）

- 画布 2828×4000；四边距 M=265；正文左缘 x=265；页脚基线 y=3790（22px, letter-spacing 1, ink 55%）；AGENTS 图例行 y=3742（19px bold）。
- 调色板（唯一允许的颜色）：纸 `#faf9f4`、墨 `#141109`、P `#8f5fc0`、O `#ef7409`、W `#3f5162`（钢白）、B `#2f83c8`、X `#6f5c44`（赭）。
- 图例顺序统一 **P O W B X**（按启用先后）。
- 记录格式：MGRS 坐标 8 字符（如 `YT080757`，mgrs.mjs 已验证：西贡→XS858921、岘港→BT003764）；完整记录为 `YYMMDD-MGRS` 15 字符。
- 页脚谱系：`OPERATION RANCH HAND    HERBS FILE    <说明>    <抽样声明>    1962–1971`（4 空格分隔；**所有 text 元素必须带 `xml:space="preserve"`**，否则 SVG 渲染折叠空格——这是踩过的坑）。
- 页脚措辞不用 "="（用户要求，正式出版物语感），用 IS / SCALED TO 句式。

## 四、三联终稿（当前状态）

| 联 | 文件 | 读法 | 要点 |
|---|---|---|---|
| 1 | `final/FINAL-time5s8.svg` | **何时**：月块流 | 每月一段落，段高=当月架次；8字符纯坐标；1-in-8（919/7,047，页脚 EVERY 8TH OF EACH MONTH）；FS23.5 自适应；左缘赭色加粗年份（无刻度线，用户要求去掉） |
| 2 | `final/FINAL-vol.svg` / `FINAL-vol2.svg` | **多少**：体积色块墙 | 块高∝各药剂加仑（行分配 66/30/6/3/1，块间 16px 缝）。vol=带日期 token（1,060 条），**vol2=纯坐标 token（1,802 条，17/行）——待用户二选一** |
| 3 | `final/FINAL-f4.svg` / `f4L` / `f4F` | **记录**：解密打印件 | 三栏台账 210 航段、91/7,047 EVERY 77TH；码本已扩至**每栏都有定义**+彩色药剂键；三种着色 **待用户三选一**：f4=字母+加仑着色 / f4L=仅字母 / f4F=整行 |

`final/FINAL-time2.svg` 为搁置候选（等距月行+完整记录，行封顶10），仅存档。

## 五、两个待决事项（新会话第一件事）

1. **vol 还是 vol2**（带日期 vs 纯坐标）——助手推荐 vol2（与 t5s8 单位统一；vol 纵轴本非时间，日期价值最低）。
2. **f4 着色选 A/B/C**（f4=字母+加仑 / f4L=仅字母 / f4F=整行）——助手倾向 B（f4L，最克制）。
定稿后：把选中版本定名（建议统一为 FINAL-vol / FINAL-f4），跑打包，出投稿包。

## 六、工具链（新容器复现步骤）

```bash
# 1) 字体（渲染必需）
mkdir -p ~/.fonts && cp poster/fonts/*.ttf ~/.fonts/ && fc-cache -f
# 2) playwright-core（Chromium 已预装在 /opt/pw-browsers）
cd poster/scripts && npm init -y >/dev/null && npm i playwright-core >/dev/null && cd ../..
# 3) 生成（脚本读 repo 根的 public/data/...，必须从 repo 根运行；SP=输出目录）
export SP=$PWD/poster/final
RATIO=0.125 BIN=month GAPL=0.12 OUT=FINAL-time5s8 node poster/scripts/time5p.mjs
node poster/scripts/volvariant.mjs        # -> FINAL-vol2
node poster/scripts/finaldiptych.mjs      # -> FINAL-vol (+FINAL-time，忽略)
node poster/scripts/f4rework.mjs          # -> FINAL-f4 / f4L / f4F
# 4) 渲染检查 PNG（脚本 import 'playwright-core'，Chromium 路径 /opt/pw-browsers/chromium-*/chrome-linux/chrome）
node poster/scripts/svg2png-hi.mjs FINAL-time5s8.svg
# 5) 投稿打包（JPEG 2828×4000 RGB 72dpi + A1 矢量 PDF + 内嵌字体 print.svg）
node poster/scripts/pack.mjs FINAL-time5s8 FINAL-vol2 FINAL-f4L   # 按最终选择
```
脚本旋钮见 time5p.mjs 头注释（RATIO/BIN/FS/GAPL/OUT/TOK）。hcompare.mjs 用法：`node hcompare.mjs OUT 宽度 name:label ...`（生成横向对比条）。

## 七、评审历史结论（10 份 agent 评审的收敛）

- 两轮"美感 70%/概念 30%"评审后，**t5s8 是唯一双评审共同前二**，用户亲选。
- 三联组合 t5s8+vol+f4 = 用户最终决定（形/色/工艺三路）。
- t5s8 对决 t6s8（带日期完整记录月块流）时评审判 t6 胜，但**用户否决**（"重复编码本身就是证词"）——尊重此决定，勿再提议给 t5s8 加日期。
- 用户口味备忘：不要大标题（"格调一下子降低了"）；不要 f4 加框线；克制>炫技；在意计量的诚实与精确（曾亲自抓出采样失真、行长截断问题）。
- 终检已修复：SVG 空格折叠（xml:space）、页脚错误陈述、抽样算术措辞、三联图例/措辞/连字符统一。

## 八、投稿信息（报名表速查）

- 类别 7；三张 JPEG 作**一个条目**上传（2828×4000 RGB 72dpi）。
- 标题建议：*A Decade of Rain — The HERBS File, Three Readings*。
- 用途文案（非倡导措辞）：*A typographic reading of the declassified U.S. military HERBS File — the complete flight record of Operation Ranch Hand herbicide spraying over Vietnam, 1962–1971. Three readings of one archive: when, how much, and the record itself.*
- 参赛者=设计者本人；制作年月如实（≥2025-09）。
- 费用：早鸟 $35（2026-08-15 22:00 JST 截止）/ 之后 $60（最终 2026-09-15）；学生 $20/$40。
- 入选后 2026-11-16 前邮寄 A1/B1 实体打印（无法邮寄不取消资格）；A1 母版 PDF 由 pack.mjs 生成。
