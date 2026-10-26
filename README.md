# 图片压缩 / Image Compressor

在线体验：https://kimorix.github.io/image-compressor/

免费开源的图片压缩 Web 工具，单文件、无后端、无依赖。

A free and open-source image compression web tool. Single HTML file, no backend, no dependencies.

## 特性 / Features

- **100% 本地处理**：所有压缩都在浏览器内完成，图片不会上传到任何服务器
- **批量处理**：拖拽、点击选择、Ctrl+V 粘贴，支持多张图片同时压缩
- **输出格式**：保持原格式 / JPEG / PNG / WebP（推荐 WebP，体积小且保真）
- **质量调节**：10%–100% 质量滑杆，实时重新压缩
- **目标体积模式**：输入目标体积（如 200KB），先按质量、再按尺寸自动调节，直到装进目标；浏览器不支持 WebP 编码（如 Safari）时自动改用 JPEG
- **尺寸缩放**：按最长边缩放，默认 1920px，可选不放大
- **前后对比**：每张图显示原始体积 → 压缩后体积及节省百分比
- **批量下载**：一键下载全部压缩结果

## 使用 / Usage

直接打开 `index.html` 即可使用，或访问 GitHub Pages 部署地址。

Just open `index.html` in a browser, no build step required.

## 注意事项 / Notes

- GIF 动图压缩后只保留首帧（Canvas API 限制）
- JPEG 不支持透明通道，透明部分会填充白色
- PNG 为无损格式，质量滑杆对 PNG 不起作用

## License

MIT
