# 图片压缩 Image Compressor

免费开源的图片压缩工具。所有处理均在浏览器本地完成，图片不会上传到任何服务器。

在线使用：https://kimorix.github.io/image-compressor/

## 功能

- 拖拽、点击选择、Ctrl+V 粘贴、批量处理
- 输出格式：保持原格式、JPEG、PNG、WebP（默认 WebP）
- 两种压缩模式：按质量（滑杆 10%–100%）；按目标体积（先二分搜最高质量、再缩尺寸兜底，直到装进目标）
- 最长边默认 1920px，可设 0 不缩放；默认不放大
- 每张图显示原体积 → 压缩后体积、节省百分比、原尺寸 → 输出尺寸、下载、移除
- 压缩前后对比：点缩略图交叉淡化切换，点预览进全屏（可切原图/压缩后、点图放大）
- 批量处理进度条；全部下载、清空列表；长文件名截短显示
- 白天 / 黑夜主题（跟随系统，可手动切换并记住）
- 界面语言下拉选择：中文、English、日本語、한국어、Français、Deutsch；默认跟随浏览器语言，手动选过后记住选择
- Safari 兼容：浏览器不支持 WebP 编码时自动改用 JPEG 并提示（而不是静默出 PNG）

## 已知限制

- GIF 动图压缩后只保留首帧
- JPEG 不支持透明通道，透明部分会填充白色
- PNG 为无损格式，画质参数不起作用，滑杆会锁定（不是 bug）

## 技术栈

Vue 3 + Vite + TypeScript，组件化、模块化：

- `src/App.vue`：页面结构与状态编排（上传 → 结果 → 设置）
- `src/components/`：DropZone、SettingsPanel、ImageItem、Lightbox、ProgressBar
- `src/lib/compress.ts`：Canvas 压缩核心（质量二分、尺寸兜底、WebP 回退探测）
- `src/lib/format.ts`：体积格式化、文件名处理
- `src/lib/theme.ts`：白天 / 黑夜主题
- `src/i18n/`：六语词典与浏览器语言检测
- `src/types.ts`：共享类型

## 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 构建到 docs/
```

## 部署

GitHub Pages 的源设为 `main` 分支的 `/docs` 文件夹，构建产物提交后即自动发布。
