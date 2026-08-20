# TDC 2027 海报项目交接文档（A Decade of Rain — HERBS File）

> 本文档是海报项目的完整交接。新会话从这里继续，无需旧对话历史。
> 语言约定：用户用中文交流，回复用中文。

## 一、项目定位

- **目标**：Tokyo TDC 2027，类别 7（Poster B，数据/实验海报）。
- **形式**：A1 竖版三联（594×841mm），画布 2828×4000 px（1:√2）。
- **风格**：type-as-data —— 整张海报全部由排版的真实数据记录构成，无照片无插画无标题字。暖纸 #faf9f4，Courier Prime 等宽（400/700），纪实克制、非倡导。
- **数据源**：仓库内 `public/data/spray-tracks.json`，由 `poster/scripts/build-tracks.mjs` 从 Stellman 的 HERBS 数字化数据（andrewstellman/hea-v，固定 commit cb5948b）重建，管线已验证（重建数据重生成的三张与修正前的已提交 SVG 逐字节一致）。

## 二、关键数据事实（已多轮核验，2026-08-15 全面复核后更新）

- **7,047 条 mapped spray runs**（多点航线，gallons>0）：机型构成 **F 固定翼 5,930 / H 直升机 875 / G 地面 99 / U 未标注 143**。措辞一律用 SPRAY RUNS，**不可写 FIXED-WING/SORTIES**（旧版此处有误，已全部修正）。
- 7,047 条 runs 总加仑 **18,905,413**；单点 marks 1,621 条、585,275 gal；两者合计 19,490,688。
- 各药剂（**runs 口径**，与海报一致）：加仑 O 11,762,648 / W 5,315,303 / B 1,166,156 / P 459,055 / X(U+K) 202,251；条数 O 4,138 / W 1,746 / B 700 / P 339 / X 124。
- 一次任务飞多条航线时，**任务加仑按各航线长度比例分摊**到每条 run（f4 脚注已声明）。
- **日期已修正**：旧版所有显示日期晚一天（数据 1 基 day、脚本 0 基解码）。现数据 0 基，显示日期与原始档案逐条一致。runs (g>0) 日期范围 **1962-02-14 → 1971-03-23**；页脚一律写 1962–1971（en-dash U+2013）。
- 十年弧线不变：1962–64 纯紫 → 1965 橙剂涌入 → 1966–69 橙洪峰 → 1970 蓝剂增多 → 1971 收尾。
- 原始记录格式文档：《Services Herbs Tape》（DTIC ADA160563 的公开版，USDA NAL 藏，https://www.nal.usda.gov/exhibits/speccoll/files/original/d092d7c887119af77f383247b4043d2c.pdf ）。f4 码本各列定义（PRO 省份码 / T 任务类型 / S 记录来源 / I 事故代码 / M 投放方式）逐码出自该文档第 9–12 页。

## 三、设计系统（三联共用）

- 画布 2828×4000；四边距 M=265；正文左缘 x=265；页脚基线 y=3790（22px, letter-spacing 1, ink 55%）；AGENTS 图例行 y=3742（19px bold）。
- 调色板（唯一允许的颜色）：纸 `#faf9f4`、墨 `#141109`、P `#8f5fc0`、O `#ef7409`、W `#3f5162`（钢白）、B `#2f83c8`、X `#6f5c44`（赭）。
- 图例顺序统一 **P O W B X**（按启用先后）。
- 记录格式：MGRS 坐标 8 字符（mgrs.mjs 与原始 UTM 字符串完全可逆互转，已验证）。
- 页脚谱系：`OPERATION RANCH HAND    HERBS FILE    <说明>    <抽样声明>    1962–1971`（4 空格分隔；**所有 text 元素必须带 `xml:space="preserve"`**——SVG 渲染否则折叠空格，踩过的坑）。
- 分隔一律用 4 空格；**不用 "="，不用 "·"**（用户要求）。

## 四、三联终稿（已定稿，投稿包已出）

| 联 | 文件 | 读法 | 要点 |
|---|---|---|---|
| 1 | `final/FINAL-time5s8.svg` | **何时**：月块流 | 每月一段落，段高=当月 run 数；8字符纯坐标；1-in-8（921/7,047）；FS23.25 自适应；左缘赭色加粗年份 |
| 2 | `final/FINAL-vol.svg` | **多少**：体积色块墙 | 纯坐标 token（1,802 条，17/行），块高∝各药剂加仑（66/30/6/3/1） |
| 3 | `final/FINAL-f4.svg` | **记录**：解密打印件 | 三栏台账 210 航段、91/7,047 EVERY 77TH；**如实转录版**：M/CTZ/PRO/T/S/I 全部照原始记录（直升机标 H、事故码可见），仅药剂字母着色、加仑不加粗；码本逐码定义 |

用户已拍板：vol 用纯坐标版；f4 用"仅字母着色+加仑不加粗+如实转录（B 版）"。曾有的变体（带日期 vol、f4 着色 A/C、M 列硬编码 F 的旧版）已从 final/ 移除，git 历史可寻。`FINAL-time2.svg` 为搁置候选，仅存档。

## 五、当前状态

- 三联终稿已生成，投稿包已出（`FINAL-*.jpg` 2828×4000 RGB 72dpi、`FINAL-*-A1.pdf` 矢量母版、`FINAL-*-print.svg` 内嵌字体），已发用户。
- 等用户最终确认后即可提交报名表（信息见第八节）。

## 六、工具链（新容器复现步骤）

```bash
# 1) 字体（渲染必需）
mkdir -p ~/.fonts && cp poster/fonts/*.ttf ~/.fonts/ && fc-cache -f
# 2) 依赖（Chromium 已预装在 /opt/pw-browsers）
cd poster/scripts && npm i && cd ../..
# 3) （仅当需重建数据）克隆源数据并重建；核对输出的校验数字
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/andrewstellman/hea-v /workspace/andrewstellman/hea-v
WRITE=1 node poster/scripts/build-tracks.mjs     # HEAV=<path> 可改源路径
# 4) 生成三联（脚本读 repo 根的 public/data/spray-tracks.json，必须从 repo 根运行；SP=输出目录）
export SP=$PWD/poster/final
RATIO=0.125 BIN=month GAPL=0.12 OUT=FINAL-time5s8 node poster/scripts/time5p.mjs
node poster/scripts/volvariant.mjs                        # -> FINAL-vol
HONEST=1 PFX=H- node poster/scripts/f4rework.mjs && mv poster/final/H-FINAL-f4L.svg poster/final/FINAL-f4.svg && rm poster/final/H-FINAL-f4.svg poster/final/H-FINAL-f4F.svg
# 5) 渲染检查 PNG / 局部放大
node poster/scripts/svg2png-hi.mjs FINAL-f4.svg
node poster/scripts/crop.mjs FINAL-f4.svg 265 340 1300 500 crop.png
# 6) 投稿打包
node poster/scripts/pack.mjs FINAL-time5s8 FINAL-vol FINAL-f4
```
f4rework：`HONEST=1` 转录真实 M/CTZ/PRO/T/S/I（终稿），不带则回退旧版（M 硬编码 F）；`PFX` 输出名前缀；mode 见文件尾 build 调用。hcompare.mjs：`node hcompare.mjs OUT 宽度 name:label ...` 生成横向对比条。

## 七、评审历史结论（累计收敛）

- 两轮"美感 70%/概念 30%"评审后，**t5s8 是唯一双评审共同前二**，用户亲选；三联组合 t5s8+vol+f4 = 用户最终决定（形/色/工艺三路）。
- t5s8 对决带日期版时评审判带日期版胜，但**用户否决**（"重复编码本身就是证词"）——勿再提议给 t5s8 加日期。
- 用户口味备忘：不要大标题（"格调一下子降低了"）；不要 f4 加框线；克制>炫技；在意计量的诚实与精确。
- 2026-08-15 数据复核（本会话）：修正日期整体 +1 天 bug；修正 FIXED-WING 不实措辞（实为四种投放方式混合）；f4 改如实转录（用户选 B 版并要求加仑不加粗）；脚注圆点分隔统一为 4 空格；spray-tracks.json 补入仓库（旧会话遗漏未提交，重建后以逐字节复现验证）。

## 八、投稿信息（报名表速查）

- 类别 7；三张 JPEG 作**一个条目**上传（2828×4000 RGB 72dpi）。
- 标题建议：*A Decade of Rain — The HERBS File, Three Readings*。
- 用途文案（非倡导措辞）：*A typographic reading of the declassified U.S. military HERBS File — the complete record of Operation Ranch Hand herbicide spraying over Vietnam, 1962–1971. Three readings of one archive: when, how much, and the record itself.*
- 参赛者=设计者本人；制作年月如实（≥2025-09）。
- 费用：早鸟 $35（2026-08-15 22:00 JST 截止）/ 之后 $60（最终 2026-09-15）；学生 $20/$40。
- 入选后 2026-11-16 前邮寄 A1/B1 实体打印（无法邮寄不取消资格）；A1 母版 PDF 由 pack.mjs 生成。

## 九、终审记录（2026-08-15）

- 四方向 agent 审查（拼写用语/页脚注脚格式/几何网格/用色一致性）后修正 6 处：vol 页脚右边距越界（字距计入后 97px）、f4 码本两空格统一与 U K 入色、SOURCE/INCIDENT 升小标题、补 T=U 与 S=A（A=Stellman 2003 修订补录）、f4 页脚语序对齐、t5s8 撇号改 U+2019。用户逐项确认。
- **投稿已完成（2026-08-15）**：Entry ID F373；报名表已提交（physical production=Yes、标题未加 Prototype，用户承诺入选后打印寄送以兑现）；F373.zip（07_F373_01_a/b/c，含全部 QA 修正）已上传；早鸟费 $35 已经 PayPal 支付（@tokyotdc，备注 F373）。待办仅剩：入选通知后 2026-11-16 前打印 A1 并邮寄（母版 = FINAL-*-A1.pdf）。

## 十、衍生单张：FINAL-map（密度点阵图，别府 art fair）

- `final/FINAL-map.svg`：每条 run 的加仑沿航线走线均摊入 5.5km 等距网格，每格一橙点、面积∝加仑（最小格托底可见，页脚已披露 SMALLEST HELD LEGIBLE）；无底图，数据自绘国土轮廓；全量 7,047 条不抽样，分摊守恒（画面总加仑 = 18,905,413）。
- 生成：`node poster/scripts/dotmap.mjs`（旋钮 CELL/OUT/RMIN）；任意纸型矢量 PDF：`node poster/scripts/pdfsize.mjs FINAL-map 707 1000`。
- 细网格变体（CELL=0.033）落选，git 历史可寻。用户选定粗网格（2026-08-20）。
