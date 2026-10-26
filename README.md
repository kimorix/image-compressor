# 图片压缩 Image Compressor

免费开源的图片压缩工具。所有处理均在浏览器本地完成，图片不会上传到任何服务器。

在线使用：https://kimorix.github.io/image-compressor/

## 功能

- 拖拽、点击选择、Ctrl+V 粘贴、批量处理
- 输出格式：保持原格式、JPEG、PNG、WebP（默认 WebP）、AVIF；支持 HEIC/HEIF 输入（iPhone 照片先解码再压缩）
- 编码器：优先用 WASM 编码器（WebP 用 libwebp、JPEG 用 MozJPEG、PNG 量化用 imagequant、AVIF 用 libaom），失败时回退到浏览器 canvas 编码；WASM 均懒加载，只在用到时下载
- PNG 量化：默认开启，截图类图片可再小 60–80%（TinyPNG 同款调色板量化）；关掉后回到无损 PNG，画质滑杆锁定
- Safari 兼容：WASM 编码不受 canvas 限制，即使浏览器不支持 WebP 编码也能出 WebP；只有 WASM 也失败时才自动改用 JPEG 并提示（而不是静默出 PNG）
- 改设置重压时旧结果保持显示，新结果到了直接替换，不闪回处理中、不冒进度条
- 两种压缩模式：按质量（滑杆 10%–100%）；按目标体积（先二分搜最高质量、再缩尺寸兜底，直到装进目标）
- 最长边默认 1920px，可设 0 不缩放；默认不放大，取消勾选后允许放大到最长边
- 输出不比原图大：重编码后体积 ≥ 原图时直接用原文件，并标注「已是最优」
- 质量滑块 300ms 防抖，拖动不卡；批量最多 3 张并发处理
- 全部下载打成一个 zip 一次下载（浏览器会拦截连续多次下载，尤其 Safari/iOS）
- 每张图显示原体积 → 压缩后体积、节省百分比、原尺寸 → 输出尺寸、下载、移除
- 压缩前后对比：点缩略图交叉淡化切换，点预览进全屏（可切原图/压缩后、点图放大）
- 批量处理进度条；全部下载、清空列表；长文件名截短显示
- 白天 / 黑夜主题（跟随系统，可手动切换并记住）
- 界面语言下拉选择：中文、English、日本語、한국어、Français、Deutsch；默认跟随浏览器语言，手动选过后记住选择
- Safari 兼容：浏览器不支持 WebP 编码时自动改用 JPEG 并提示（而不是静默出 PNG）

## 已知限制

- GIF 动图压缩后只保留首帧
- JPEG 不支持透明通道，透明部分会填充白色
- PNG 为无损格式时画质参数不起作用，滑杆会锁定（不是 bug）；量化开启时画质影响调色板质量，滑杆可用
- AVIF 编码较慢，大图或批量时请耐心等几秒

## 技术栈

Vue 3 + Vite + TypeScript，组件化、模块化：

- `src/App.vue`：页面结构与状态编排（上传 → 结果 → 设置）
- `src/components/`：DropZone、SettingsPanel、ImageItem、Lightbox、ProgressBar
- `src/style.less`：样式（Less 嵌套写法；主题 token 仍用 CSS 变量，因为主题在运行时切换）
- `src/lib/compress.ts`：压缩核心（WASM 优先、canvas 兜底、质量二分、尺寸兜底、WebP 回退探测、已是最优回退）
- `src/lib/wasm-encoders.ts`：WASM 编码器懒加载（libwebp / MozJPEG / libaom / imagequant）与 HEIC 解码（heic2any）
- fflate：全部下载时打包 zip
- `src/lib/format.ts`：体积格式化、文件名处理
- `src/lib/theme.ts`：白天 / 黑夜主题
- `src/i18n/`：六语词典与浏览器语言检测
- `src/types.ts`：共享类型

## 本地开发

```bash
pnpm install
pnpm dev       # 开发服务器
pnpm build     # 构建到 docs/
```

## 部署

GitHub Pages 的源设为 `main` 分支的 `/docs` 文件夹，构建产物提交后即自动发布。
