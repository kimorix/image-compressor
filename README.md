# 图片压缩 Image Compressor

免费开源的图片压缩工具。所有处理均在浏览器本地完成，图片不会上传到任何服务器。

在线使用：https://kimorix.github.io/image-compressor/

## 功能

- 拖拽、点击选择、Ctrl+V 粘贴、批量处理；可拖入整个文件夹（递归读取，打包 zip 时保留目录结构）
- 设置只有四行：场景、格式、压缩、尺寸；高级设置默认收起
- 输出格式：智能（默认）、保持原格式、JPEG、PNG、WebP、AVIF；支持 HEIC/HEIF 输入（iPhone 照片先解码再压缩）
- 智能格式：按图片内容选格式。颜色少（含透明图标、logo）用 PNG 调色板量化，边缘不出噪点；照片用 WebP，带透明时透明通道保持无损
- 智能画质（默认）：在 q50–q90 之间二分搜索，找到与原图 SSIM ≥ 0.985 的最低质量。简单的图更小，细节多的图自动提高质量不糊；预览里会显示选中的质量
- 编码器：优先用 WASM 编码器（WebP 用 libwebp、JPEG 用 MozJPEG、PNG 量化用 imagequant、AVIF 用 libaom），失败时回退到浏览器 canvas 编码；WASM 均懒加载，只在用到时下载
- PNG 量化：默认开启，截图类图片可再小 60–80%（TinyPNG 同款调色板量化）；关掉后回到无损 PNG，画质滑杆锁定
- Safari 兼容：WASM 编码不受 canvas 限制，即使浏览器不支持 WebP 编码也能出 WebP；只有 WASM 也失败时才自动改用 JPEG 并提示（而不是静默出 PNG）
- 改设置重压时旧结果保持显示，新结果到了直接替换，不闪回处理中、不冒进度条
- 另外两种压缩方式：按画质（滑杆 10%–100%）；按体积（先二分搜最高质量、再缩尺寸兜底，直到装进目标；有 200 / 500 / 1000KB 快捷值）
- 尺寸：不缩放、最长边 2560 / 1920（默认）/ 1280、1 寸证件照 295×413、2 寸证件照 413×579，或自定义最长边 / 宽 / 高 / 百分比 / 裁剪到宽×高（居中裁剪）；默认不放大
- 输出不比原图大：重编码后体积 ≥ 原图时直接用原文件，并标注「无需压缩」
- 质量滑块 300ms 防抖，拖动不卡；压缩在 Web Worker 里进行，按 CPU 核数开 2–4 个 Worker 并发
- 只有一张已完成时「全部下载」直接下载这张图；两张以上打成一个 zip 一次下载（浏览器会拦截连续多次下载，尤其 Safari/iOS）
- 桌面每张图显示原体积 → 压缩后体积、节省百分比、原尺寸 → 输出尺寸（尺寸变化时上下排列，不变时一行 A → A）、格式标签、状态标签；格式和尺寸列内容居中；已最优和“可不压”都用同款灰色小标签；以及复制、分享（触屏且支持文件分享时）、下载、移除四个图标；放大输出时尺寸行用警示色。手机改为图片优先的双列瀑布流卡片：右上角节省/无需压缩/处理中/排队/失败角标、GIF 左上角标、文件名最多两行且保留扩展名、单行体积+格式、卡片右下角 28px 下载/分享按钮；小图、透明转 JPEG 等提示用一个小圆点表示
- 结果区顶部是扁平四格统计条（已完成 / 原始大小 / 压缩后 / 节省空间），四列在手机上也保持一行；手机上隐藏绝对值副行，只保留百分比；节省百分比用柔和的绿色，0% 为灰色
- 结果表：宽屏 1366px 以上为带表头的固定列表格（图片、格式、原体积、压缩后、节省、尺寸、状态、操作；桌面表格省略文件名，悬停行可看全名）；720–1365px 自动换成 84px 缩略图的堆叠行；手机（<720px）改为 JS 计算的双列瀑布流，列间距 8px、卡片圆角 12px，用原图宽高比估算高度并把每张卡放进当前较矮的一列，卡片不会因排队/压缩中/完成或新增图片而换列，只有删除/清空才重新分配；缩略图比例限制在 3:4–4:3，超长截图/超宽横幅裁切，8×8 小图 contain；桌面每页 20 条，手机不分页，统计条和下载不受影响
- 预览：桌面右侧对比卡片拖动分割线对比，卡片紧贴设置栏、显示文件名、底部信息与下载按钮同一行；移动端不渲染预览卡，点击卡片从底部弹出详情面板：对比滑块、完整文件名、体积/百分比、尺寸、格式、全部提示，以及复制 / 删除 / 下载（触屏支持文件分享时为“保存到相册”）。点对比图进入全屏 Lightbox；面板支持下滑、点遮罩、Esc 关闭并锁定背景滚动。全屏预览支持适合 / 100% / 200%，带文件名、焦点圈定和 Esc 关闭；桌面端快捷键：← / → 切换图片，空格在原图和压缩后之间切换
- 批量处理进度条；压缩 / 重新压缩 / 打包 zip 时显示全屏 loading 遮罩，页面不可点击、不可滚动、不可新增图片，结束后自动恢复；压缩中显示完成张数并可取消，尝试新增图片会提示等待，刷新/关闭页面前会提示；全部下载、清空列表（第一次点只变「确认清空？」，3 秒内再点才真清）；长文件名省略显示（保留扩展名）；导入后默认回到第 1 页，桌面每页 20 条；缩略图条可横向翻页，页面滚动时吸顶（吸顶后保持完整信息，不改变高度，避免抖动）
- 设置栏桌面端固定在右侧；高级设置里的 JPEG 填充色为 18px 色块 + 右侧十六进制值，和复选框行对齐；空列表时「开始压缩」置灰，有结果后变为「重新压缩」；常用场景一键套用：微信发图、公众号配图、证件照（1 寸裁剪 + ≤200KB）、网站/博客、邮件附件，选回「自定义」恢复之前的设置；设置是全局唯一的，改一次全部图片一起重压
- 压缩历史记录保存在本地（localStorage，最多 200 条）
- 白天 / 黑夜主题（跟随系统，可手动切换并记住）
- 界面语言下拉选择：中文、English、日本語、한국어、Français、Deutsch；默认跟随浏览器语言，手动选过后记住选择
- 移动端：有结果后隐藏顶部上传卡（底部「+ 添加」接管），结果区直接贴在最上面；统计条压成两行；结果改为双列瀑布流，390×844 首屏至少 4 张完整卡片；底部固定「添加 / 清空 / 全部下载」栏 + 首页/设置/更多 Tab（三个按钮在 320px 德语下自动收缩换行，不横向溢出）；更多菜单列出「格式转换」「尺寸与水印」两个图片工具，分隔线下是「历史记录」（手机上进入压缩历史的入口，在历史页时高亮；32px 图标、290px 宽、14px 圆角，支持点遮罩/再点更多/Esc 关闭），不放主题、GitHub 和清空；预览卡不渲染，点卡片打开底部详情面板；分页/关闭/缩放/删除/详情按钮按 44px 触摸目标处理；移动端表单控件统一 16px 防止 iOS 聚焦自动放大，≤360px 设置项改为标签在上、控件在下，避免德语/法语选项文字被截断
- PWA：可安装、断网可用（应用与压缩 Worker 预缓存；各编码器 WASM 和 HEIC 解码器首次用到时下载并缓存）
- 隐私：压缩会去掉照片的位置等拍摄信息，图片不会上传；JPEG 可选「保留拍摄信息」

## PDF 转 Word（`#/pdf-to-word`）

- 和图片压缩一样完全在浏览器本地转换，文件不上传；桌面侧栏和手机底栏（压缩 / PDF / 设置 / 更多）都有入口
- 两种模式：**可编辑**（重排成 Word 段落：标题样式、Word 编号列表、粗体/斜体、简单表格、图片按阅读顺序插入，双栏按先左后右排列，页码去掉，跨页断开的段落接回）；**保留版式**（每页一节、页面尺寸同 PDF，每行文字放在定位文本框里、图片浮动在原位置，看起来和 PDF 一样，文字仍可编辑）
- 页码范围（如 `1-3,5`、`8-`）、保留图片开关、多文件排队转换（桌面同时 2 个、手机 1 个）、逐页进度、随时取消、失败可重试、全部下载打成 zip；手机上「全部存储 / 下载」和详情面板走系统分享
- 加密 PDF：列表里直接输入密码解锁，密码错误会提示
- 扫描件：自动识别（没有文字、整页是图片），默认按图片放入 Word；开启「扫描件 OCR」后用 tesseract.js 识别文字（首次使用从 jsDelivr 下载识别引擎和语言数据，约 7–9 MB，设置里按所选语言显示；之后离线可用；支持简/繁中文、英、日、韩、德、法，默认界面语言 + 英文）
- 性能：每页读完就交给 docx Worker 逐页分析（图片缓冲转移，不在主线程堆积）；支持 OffscreenCanvas 时裁图在 Worker 里编码；只有有图要裁或扫描页才渲染，渲染上限手机约 4MP、桌面约 10MP
- 体积：首屏不加载任何 PDF 代码；pdf.js（legacy 构建，兼容老 iOS）、docx、tesseract 都在进入 PDF 页或真正用到时才下载，并且不进 PWA 预缓存，用过一次后缓存

## 已知限制

- GIF 动图压缩后只保留首帧（动画 WebP 输出在计划中）
- JPEG 不支持透明通道，透明部分会填充白色
- PNG 为无损格式时画质参数不起作用，滑杆会锁定（不是 bug）；量化开启时画质影响调色板质量，滑杆可用
- AVIF 编码器约 3.5MB，首次使用需要下载，编码也较慢；选 AVIF 时设置栏会提示
- 智能画质每张图要多编码、解码几次（通常 2–3 次），比固定质量慢一些
- 单张超过 50MB 或超过 8000 万像素的图片会被跳过/报错并提示（避免一次性把解码后的像素撑爆内存）
- PDF 转 Word：复杂表格（合并单元格、单元格内多行、无对齐的表格）、公式、文本框、竖排文字和旋转文字不能还原结构（文字仍会保留）；图片是从渲染后的页面裁出来的，压在图片上的文字会一起进图片；OCR 首次使用需要联网

## 技术栈

Vue 3 + Vite + TypeScript：

- `src/App.vue`：薄壳，按 hash 路由切换功能视图，KeepAlive 保留各自状态；除压缩外都懒加载。路由：图片工具 `#/`（压缩）、`#/convert`（格式转换）、`#/resize`（尺寸与水印）；PDF 工具 `#/pdf-to-word`、`#/img-to-pdf`、`#/pdf-merge`；`#/history`。还没做好的工具先显示占位页（`ToolPlaceholder.vue`）
- `src/shared/`：各功能共用的部分
  - `components/`：AppHeader、SideNav（图片工具 / PDF 工具分组）、TabBar（压缩 / PDF / 设置 / 更多）、MoreMenu、PdfHubSwitch（手机 PDF 工具页的分段切换，记住上次用的 PDF 工具）、SegmentedControl、PageGrid（可拖动排序的缩略图网格，图片转 PDF 和合并拆分共用；可选分组标题：传 `groupKey`（+ `groupLabel` 或 `#group-header` 插槽）后连续同组的项另起一行并带标题，不传时 DOM 和行为与原来完全一致；纯逻辑在 `page-grid.ts`）、BottomSheet、`nav.ts`（工具清单，一处定义）
  - `image/`：图片编解码：`wasm-encoders`、`heic`、`gif`、`icc`、`exif`、`limits`、`codec`（解码 / canvas / 编码辅助）、`sniff`（按文件头识别格式）、`image-pool`（全站唯一的图片 Worker 池，按任务类型分派，见 `jobs.ts`）
  - `pdf/`：`pdf-loader`（pdf.js 懒加载）、`page-range`（页码范围，含按组解析 `parseRangeGroups`）
  - `composables/`、`i18n/`、`lib/`：usePrefs（语言/主题）、useHashRoute、六语词典、`share.ts`（系统分享 + 兜底）、`zip.ts`（流式 zip / 下载）、`drop.ts`（拖入文件夹）、`format.ts`、`theme.ts`
- `src/features/image-compressor/`：图片压缩（`CompressorView.vue`、`components/`、`lib/`：compress（压缩管线，`forceFormat` 选项供格式转换用）、compress-job（图片池任务）、compress-pool（压缩器对共享池的封装）、ssim、presets、recompress、masonry、settings-store 等）
- `src/features/format-convert/`：格式转换（`ConvertView.vue`、`components/`（ConvertSettings 桌面卡片与手机设置面板共用、ConvertDetailSheet 手机详情）、`lib/`：convert（纯逻辑：按来源推荐格式、命名去重、透明填充、设置签名）、convert-job（图片池任务：原尺寸解码 → JPEG/PNG/WebP/AVIF 编码，P3 回写，EXIF 跨格式保留且始终移除 GPS）、settings-store（`ic-convert-settings`，未手动选格式前为「自动」）；`styles/convert.less`；`i18n.ts` 功能内六语言文案）。与压缩器共用图片池、编码器和 `shared/image/exif-any.ts`，不改压缩器代码
- `src/features/pdf-to-word/`：PDF 转 Word（`PdfToWordView.vue`、`components/`、`lib/`：layout、extract、docx-builder、ocr、convert、settings；`worker/docx.worker.ts`；`styles/pdf.less`；`i18n.ts` 功能内六语言文案）
- `DESIGN.md`：设计规范。以 VoltAgent/awesome-design-md 的 `design-md/linear.app` 为基准，补充了本项目的浅色模式、扁平统计条、结果表格、移动端外壳和压缩语义色
- `src/style.less`：样式（Less 嵌套写法；主题 token 仍用 CSS 变量，因为主题在运行时切换）
- `scripts/seo-pages.mjs`：构建后按语言生成 `docs/<lang>/` 静态壳（标题 / 描述已翻译、资源路径上移一级、启动语言钉死该语言）
- PWA：vite-plugin-pwa，Service Worker 预缓存应用与 worker；MozJPEG / PNG / imagequant / WebP / AVIF 的 WASM 和 HEIC 解码器首次用到时下载并缓存（`globIgnores` 排除了它们，首访预缓存约 0.54MB）；heic2any 以哈希资源发出一份，Worker 与主线程回退共用；导航兜底只限根路径（语言壳是真实文件，不能被根壳劫持）；语言壳各带一份注册脚本（指回根 sw.js、同根 scope，共用一个注册）
- fflate：全部下载时打包 zip
- `tests/fixtures/`：PDF 转 Word 的样例 PDF（`make-pdfs.py` 生成：中英混排报告、双栏论文、加密、扫描件）
- `src/i18n/`：六语词典与浏览器语言检测
- `src/types.ts`：共享类型

## 本地开发

```bash
pnpm install
pnpm dev       # 开发服务器
pnpm build     # 构建到 docs/，并生成 docs/<lang>/ 多语言静态壳
pnpm typecheck # vue-tsc 类型检查
pnpm test      # 单元测试（vitest，tests/unit/）
```

端到端测试 `tests/suite-vue.js` 用 Playwright 跑构建后的 `docs/`，测试图片不在仓库里。可用环境变量指定路径：

```bash
cd tests && npm i
IC_CHROME=/path/to/chrome-headless-shell IC_FIXTURES=/path/to/fixtures/ IC_BASE=http://127.0.0.1:8901/ node suite-vue.js
```

## 部署

GitHub Pages 的源设为 `main` 分支的 `/docs` 文件夹，构建产物提交后即自动发布。

每次 push 和 PR 会由 GitHub Actions（`.github/workflows/ci.yml`）跑类型检查、单元测试和构建，并检查提交的 `docs/` 和源码构建结果一致，防止只提交构建产物、忘了提交源码。
