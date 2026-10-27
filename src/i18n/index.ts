export type Lang = 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
]

type Fn = (...args: (string | number)[]) => string
type Messages = Record<string, string | Fn>

const zh: Messages = {
  appTitle: '图片压缩', badgeLocal: '100% 本地处理',
  headerSub: '图片不会上传到任何服务器 · 支持批量 · 开源免费', githubBtn: 'GitHub ↗',
  dropTitle: '拖拽图片到这里，或点击选择', dropTitleTouch: '点击选择图片',
  dropSub: '支持 JPG、PNG、WebP、GIF（首帧）、BMP、SVG 等常见格式，也可直接 Ctrl+V 粘贴',
  dropSubTouch: '支持 JPG、PNG、WebP、GIF（首帧）、BMP、SVG 等常见格式，也可直接粘贴图片',
  dropAria: '选择图片', addMore: '+ 添加更多', addBtn: '+ 添加', dropAnywhere: '松开添加图片',
  fmtLabel: '输出格式', fmtOriginal: '保持原格式', fmtJpeg: 'JPEG（体积最小，适合照片）',
  fmtPng: 'PNG（无损，适合截图/线条图）', fmtWebp: 'WebP（体积小且保真，推荐）', fmtAvif: 'AVIF（新一代格式，编码较慢）',
  modeLabel: '压缩模式', modeQuality: '按质量（手动调画质）', modeTarget: '按目标体积（自动调画质）',
  targetLabel: '目标体积（KB / 每张）', qualityLabel: '质量', maxLabel: '最长边（像素，0 = 不缩放）',
  noUpscale: '不放大图片（只缩小）', downloadAll: '全部下载', clearAll: '清空列表', presetLabel: '一键场景', preset_wechat: '微信发图', preset_article: '公众号配图', preset_idphoto: '证件照 ≤200KB', preset_website: '网站/博客 WebP 1600', preset_email: '邮件附件 ≤1MB', presetCancelTitle: '再点一次取消选择', clearConfirm: '确认清空？', allBestNote: (n) => `${n} 张未压缩，将保留原图`, filteredNote: (n) => `已跳过 ${n} 个非图片文件`,
  footer: '隐私：压缩会去掉照片的位置等拍摄信息，图片不会上传。',
  pngHint: 'PNG 为无损格式，画质参数不起作用，滑杆已锁定', pngQuantHint: '量化开启时画质滑杆控制调色板质量', quantizeLabel: 'PNG 调色板量化（有损，体积更小）', keepExifLabel: '保留拍摄信息（仅 JPEG）', fmtJpegNote: 'JPEG 不支持透明通道，透明部分会填充白色', fmtWebpNote: '浏览器不支持 WebP 编码时会自动改用 JPEG', modeTargetNote: '目标体积模式：先按质量、再按尺寸自动调节，直到装进目标', shareBtn: '分享', copyBtn: '复制图片', copied: '已复制', copyFailed: '复制失败，浏览器不支持', smallSaveNote: '已经很小，可不压', smallSaveQuantNote: '已经很小，试试 PNG 量化', alphaJpegNote: '含透明通道，转 JPEG 后透明部分会填充白色', useWebpBtn: '改用 WebP', gifFirstFrame: '仅保留首帧', jpegFillLabel: 'JPEG 填充色', keepOriginalNameLabel: '保持原文件名（不加 -compressed 后缀）', resizeModeLabel: '缩放方式', resizeLongest: '最长边', resizeWidth: '宽度', resizeHeight: '高度', resizePercent: '百分比', resizeWidthLabel: '宽度（像素，0 = 不缩放）', resizeHeightLabel: '高度（像素，0 = 不缩放）', resizePercentLabel: '缩放百分比（%，100 = 不变）',
  decodeError: '无法解码该图片', formatError: '浏览器不支持输出该格式', compressFail: '压缩失败',
  typeNoteWebp: '当前浏览器不支持 WebP 编码，已自动改用 JPEG',
  targetBest: '已是最高画质，仍小于目标', targetUnder: '已小于目标', targetMin: '已缩到最小，仍超目标', alreadyBest: '已最优，保留原图',
  targetAutoQ: (q) => `自动质量 ${q}%`,
  targetAutoSize: (w, h) => `自动尺寸 ${w}×${h}`,
  targetAutoSizeLow: (w, h) => `自动尺寸 ${w}×${h}（最低画质）`,
  sumBig: (s) => `−${s}%`,
  summaryDetail: (n, d, o, c) => `共 ${n} 张，已完成 ${d} 张 · 原始 <span class="nw">${o}</span> → 压缩后 <span class="nw">${c}</span>`,
  sizes: (a, b) => `<span class="nw">${a}</span> → <span class="nw">${b}</span>`,
  processing: '处理中…', dimsUnchanged: '（尺寸未变）',
  processingCount: (f, n) => `正在处理 ${f}/${n} 张`,
  thumbHint: '点击左侧图片可预览', thumbTitle: '点击预览',
  tagOrig: '原图', tagComp: '压缩后', lbClose: '关闭', lbCompare: '拖动对比原图和压缩图', lbZoomHint: '拖动分割线对比，点图切换适合 / 100% / 200%', lbFit: '适合',
  btnDownload: '下载', btnRemove: '移除',
  themeToDay: '切换到白天模式', themeToNight: '切换到黑夜模式', themeAria: '切换主题',
  docTitle: '图片压缩 - 100% 本地处理',
  metaDesc: '免费开源的图片压缩工具，所有处理均在浏览器本地完成，图片不会上传到任何服务器。',
  langAria: '显示语言',
}

const en: Messages = {
  appTitle: 'Image Compressor', badgeLocal: '100% Local',
  headerSub: 'Images never leave your device · Batch support · Free & open source', githubBtn: 'GitHub ↗',
  dropTitle: 'Drag images here, or click to select', dropTitleTouch: 'Tap to select images',
  dropSub: 'Supports JPG, PNG, WebP, GIF (first frame), BMP, SVG and more. You can also paste with Ctrl+V',
  dropSubTouch: 'Supports JPG, PNG, WebP, GIF (first frame), BMP, SVG and more. You can also paste images directly',
  dropAria: 'Select images', addMore: '+ Add more', addBtn: '+ Add', dropAnywhere: 'Drop to add images',
  fmtLabel: 'Output format', fmtOriginal: 'Keep original', fmtJpeg: 'JPEG (smallest, best for photos)',
  fmtPng: 'PNG (lossless, best for screenshots)', fmtWebp: 'WebP (small & high quality, recommended)', fmtAvif: 'AVIF (next-gen format, slower to encode)',
  modeLabel: 'Compression mode', modeQuality: 'By quality (manual)', modeTarget: 'By target size (auto)',
  targetLabel: 'Target size (KB / per image)', qualityLabel: 'Quality', maxLabel: 'Longest side (px, 0 = no resize)',
  noUpscale: "Don't upscale (only shrink)", downloadAll: 'Download all', clearAll: 'Clear list', presetLabel: 'Presets', preset_wechat: 'WeChat image', preset_article: 'WeChat article image', preset_idphoto: 'ID photo ≤200KB', preset_website: 'Website / Blog WebP 1600', preset_email: 'Email attachment ≤1MB', presetCancelTitle: 'Click again to cancel', clearConfirm: 'Confirm clear?', allBestNote: (n) => `${n} images uncompressed, originals will be kept`, filteredNote: (n) => `Skipped ${n} non-image files`,
  footer: 'Privacy: compression strips location and other metadata from photos; nothing is uploaded.',
  pngHint: 'PNG is lossless, so the quality setting has no effect and the slider is locked', pngQuantHint: 'With quantization on, the quality slider controls palette quality', quantizeLabel: 'PNG palette quantization (lossy, smaller)', keepExifLabel: 'Keep metadata (JPEG only)', fmtJpegNote: 'JPEG has no transparency — transparent areas are filled white', fmtWebpNote: 'If the browser cannot encode WebP, it falls back to JPEG automatically', modeTargetNote: 'Target size mode: adjusts quality first, then dimensions, until the file fits the target', shareBtn: 'Share', copyBtn: 'Copy image', copied: 'Copied', copyFailed: 'Copy failed — browser does not support it', smallSaveNote: 'Already small — barely worth compressing', smallSaveQuantNote: 'Already small — try PNG quantization', alphaJpegNote: 'Has transparency — JPEG fills transparent areas white', useWebpBtn: 'Use WebP instead', gifFirstFrame: 'First frame only', jpegFillLabel: 'JPEG fill color', keepOriginalNameLabel: 'Keep original filename (no -compressed suffix)', resizeModeLabel: 'Resize by', resizeLongest: 'Longest side', resizeWidth: 'Width', resizeHeight: 'Height', resizePercent: 'Percent', resizeWidthLabel: 'Width (px, 0 = no resize)', resizeHeightLabel: 'Height (px, 0 = no resize)', resizePercentLabel: 'Scale percent (%, 100 = unchanged)',
  decodeError: 'Cannot decode this image', formatError: 'This browser cannot encode this format', compressFail: 'Compression failed',
  typeNoteWebp: 'This browser cannot encode WebP, switched to JPEG automatically',
  targetBest: 'Already at best quality, still under target', targetUnder: 'Already under target', targetMin: 'Already at minimum size, still over target', alreadyBest: 'Already optimal, original kept',
  targetAutoQ: (q) => `Auto quality ${q}%`,
  targetAutoSize: (w, h) => `Auto size ${w}×${h}`,
  targetAutoSizeLow: (w, h) => `Auto size ${w}×${h} (lowest quality)`,
  sumBig: (s) => `−${s}%`,
  summaryDetail: (n, d, o, c) => `${n} images, ${d} done · Original <span class="nw">${o}</span> → Compressed <span class="nw">${c}</span>`,
  sizes: (a, b) => `<span class="nw">${a}</span> → <span class="nw">${b}</span>`,
  processing: 'Processing…', dimsUnchanged: '(unchanged)',
  processingCount: (f, n) => `Processing ${f}/${n}`,
  thumbHint: 'Click the thumbnail to preview', thumbTitle: 'Click to preview',
  tagOrig: 'Original', tagComp: 'Compressed', lbClose: 'Close', lbCompare: 'Drag to compare original and compressed', lbZoomHint: 'Drag the divider to compare, click the image to cycle fit / 100% / 200%', lbFit: 'Fit',
  btnDownload: 'Download', btnRemove: 'Remove',
  themeToDay: 'Switch to day mode', themeToNight: 'Switch to night mode', themeAria: 'Toggle theme',
  docTitle: 'Image Compressor - 100% Local',
  metaDesc: 'Free open-source image compression tool. Everything runs locally in your browser — images are never uploaded.',
  langAria: 'Display language',
}

const ja: Messages = {
  appTitle: '画像圧縮', badgeLocal: '100% ローカル処理',
  headerSub: '画像はサーバーに送信されません · 一括処理対応 · 無料・オープンソース', githubBtn: 'GitHub ↗',
  dropTitle: '画像をここにドラッグ、またはクリックして選択', dropTitleTouch: 'タップして画像を選択',
  dropSub: 'JPG、PNG、WebP、GIF（最初のフレーム）、BMP、SVG などに対応。Ctrl+V での貼り付けも可能',
  dropSubTouch: 'JPG、PNG、WebP、GIF（最初のフレーム）、BMP、SVG などに対応。画像の直接貼り付けも可能',
  dropAria: '画像を選択', addMore: '+ 追加', addBtn: '+ 追加', dropAnywhere: 'ドロップして画像を追加',
  fmtLabel: '出力形式', fmtOriginal: '元の形式を維持', fmtJpeg: 'JPEG（最も小さい、写真に最適）',
  fmtPng: 'PNG（可逆、スクリーンショットに最適）', fmtWebp: 'WebP（小さく高画質、おすすめ）', fmtAvif: 'AVIF（次世代フォーマット、エンコードは遅め）',
  modeLabel: '圧縮モード', modeQuality: '画質指定（手動）', modeTarget: '目標サイズ指定（自動）',
  targetLabel: '目標サイズ（KB / 1枚）', qualityLabel: '画質', maxLabel: '長辺（px、0 = リサイズなし）',
  noUpscale: '拡大しない（縮小のみ）', downloadAll: 'すべてダウンロード', clearAll: 'リストをクリア', presetLabel: 'プリセット', preset_wechat: 'WeChat 画像', preset_article: 'WeChat 記事画像', preset_idphoto: '証明写真 ≤200KB', preset_website: 'ウェブサイト / ブログ WebP 1600', preset_email: 'メール添付 ≤1MB', presetCancelTitle: 'もう一度クリックで解除', clearConfirm: 'クリアしますか？', allBestNote: (n) => `${n} 枚は圧縮されず、元画像が保持されます`, filteredNote: (n) => `画像以外のファイル ${n} 件をスキップしました`,
  footer: 'プライバシー：圧縮時に位置情報などのメタデータは除去され、画像がアップロードされることはありません。',
  pngHint: 'PNG は可逆形式のため、画質設定は無効でスライダーはロックされています', pngQuantHint: '量子化が有効な場合、画質スライダーでパレット品質を調整します', quantizeLabel: 'PNG パレット量子化（非可逆、より小さい）', keepExifLabel: '撮影情報を保持（JPEG のみ）', fmtJpegNote: 'JPEG は透明度に対応していないため、透明部分は白で塗りつぶされます', fmtWebpNote: 'WebP エンコードに対応していないブラウザでは自動的に JPEG になります', modeTargetNote: '目標サイズモード：まず画質、次にサイズを自動調整し、目標に収まるまで続けます', shareBtn: '共有', copyBtn: '画像をコピー', copied: 'コピーしました', copyFailed: 'コピーに失敗しました（ブラウザ非対応）', smallSaveNote: 'すでに小さいため、圧縮するほどでもありません', smallSaveQuantNote: 'すでに小さいですが、PNG 量子化を試すとさらに小さくなります', alphaJpegNote: '透明部分があります — JPEG では透明部分が白で塗りつぶされます', useWebpBtn: 'WebP に切替', gifFirstFrame: '最初のフレームのみ', jpegFillLabel: 'JPEG 塗りつぶし色', keepOriginalNameLabel: '元のファイル名を保持（-compressed を付けない）', resizeModeLabel: 'リサイズ方法', resizeLongest: '最長辺', resizeWidth: '幅', resizeHeight: '高さ', resizePercent: 'パーセント', resizeWidthLabel: '幅（ピクセル、0 = リサイズなし）', resizeHeightLabel: '高さ（ピクセル、0 = リサイズなし）', resizePercentLabel: '拡大縮小率（%、100 = 変更なし）',
  decodeError: 'この画像をデコードできません', formatError: 'このブラウザはこの形式を出力できません', compressFail: '圧縮に失敗しました',
  typeNoteWebp: 'このブラウザは WebP エンコードに対応していないため、自動的に JPEG に切り替えました',
  targetBest: '最高画質でも目標を下回っています', targetUnder: 'すでに目標を下回っています', targetMin: '最小サイズまで縮小しましたが、まだ目標を超えています', alreadyBest: 'すでに最適、元画像を保持',
  targetAutoQ: (q) => `自動画質 ${q}%`,
  targetAutoSize: (w, h) => `自動サイズ ${w}×${h}`,
  targetAutoSizeLow: (w, h) => `自動サイズ ${w}×${h}（最低画質）`,
  sumBig: (s) => `−${s}%`,
  summaryDetail: (n, d, o, c) => `${n} 枚中 ${d} 枚完了 · 元サイズ <span class="nw">${o}</span> → 圧縮後 <span class="nw">${c}</span>`,
  sizes: (a, b) => `<span class="nw">${a}</span> → <span class="nw">${b}</span>`,
  processing: '処理中…', dimsUnchanged: '（サイズ変更なし）',
  processingCount: (f, n) => `処理中 ${f}/${n} 枚`,
  thumbHint: 'サムネイルをクリックするとプレビュー', thumbTitle: 'クリックでプレビュー',
  tagOrig: '元画像', tagComp: '圧縮後', lbClose: '閉じる', lbCompare: 'ドラッグして元画像と圧縮後を比較', lbZoomHint: '仕切りをドラッグして比較、画像をクリックでフィット / 100% / 200% を切替', lbFit: 'フィット',
  btnDownload: 'ダウンロード', btnRemove: '削除',
  themeToDay: 'デイモードに切り替え', themeToNight: 'ナイトモードに切り替え', themeAria: 'テーマを切り替え',
  docTitle: '画像圧縮 - 100% ローカル処理',
  metaDesc: '無料のオープンソース画像圧縮ツール。すべての処理はブラウザ内で行われ、画像がアップロードされることはありません。',
  langAria: '表示言語',
}

const ko: Messages = {
  appTitle: '이미지 압축', badgeLocal: '100% 로컬 처리',
  headerSub: '이미지가 서버로 전송되지 않습니다 · 일괄 처리 지원 · 무료 오픈소스', githubBtn: 'GitHub ↗',
  dropTitle: '이미지를 여기로 드래그하거나 클릭하여 선택', dropTitleTouch: '탭하여 이미지 선택',
  dropSub: 'JPG, PNG, WebP, GIF(첫 프레임), BMP, SVG 등을 지원합니다. Ctrl+V로 붙여넣을 수도 있습니다',
  dropSubTouch: 'JPG, PNG, WebP, GIF(첫 프레임), BMP, SVG 등을 지원합니다. 이미지를 직접 붙여넣을 수도 있습니다',
  dropAria: '이미지 선택', addMore: '+ 더 추가', addBtn: '+ 추가', dropAnywhere: '놓으면 이미지가 추가됩니다',
  fmtLabel: '출력 형식', fmtOriginal: '원본 형식 유지', fmtJpeg: 'JPEG(가장 작음, 사진에 적합)',
  fmtPng: 'PNG(무손실, 스크린샷에 적합)', fmtWebp: 'WebP(작고 고화질, 추천)', fmtAvif: 'AVIF(차세대 포맷, 인코딩 느림)',
  modeLabel: '압축 모드', modeQuality: '화질 지정(수동)', modeTarget: '목표 용량 지정(자동)',
  targetLabel: '목표 용량(KB / 장당)', qualityLabel: '화질', maxLabel: '긴 변(px, 0 = 크기 조정 안 함)',
  noUpscale: '확대하지 않음(축소만)', downloadAll: '모두 다운로드', clearAll: '목록 지우기', presetLabel: '프리셋', preset_wechat: '위챗 이미지', preset_article: '위챗 아티클 이미지', preset_idphoto: '증명사진 ≤200KB', preset_website: '웹사이트 / 블로그 WebP 1600', preset_email: '이메일 첨부 ≤1MB', presetCancelTitle: '다시 클릭하면 해제', clearConfirm: '지우시겠습니까?', allBestNote: (n) => `${n}장이 압축되지 않아 원본이 유지됩니다`, filteredNote: (n) => `이미지가 아닌 파일 ${n}개를 건너뛰었습니다`,
  footer: '개인정보: 압축 시 위치 정보 등 메타데이터가 제거되며, 이미지가 업로드되지 않습니다.',
  pngHint: 'PNG는 무손실 형식이므로 화질 설정이 적용되지 않아 슬라이더가 잠겨 있습니다', pngQuantHint: '양자화 사용 시 품질 슬라이더가 팔레트 품질을 조절합니다', quantizeLabel: 'PNG 팔레트 양자화(손실, 더 작음)', keepExifLabel: '촬영 정보 유지(JPEG만)', fmtJpegNote: 'JPEG은 투명도를 지원하지 않으므로 투명 부분은 흰색으로 채워집니다', fmtWebpNote: '브라우저가 WebP 인코딩을 지원하지 않으면 자동으로 JPEG으로 전환됩니다', modeTargetNote: '목표 용량 모드: 먼저 화질을, 다음으로 크기를 자동 조절하여 목표에 들어갈 때까지 계속합니다', shareBtn: '공유', copyBtn: '이미지 복사', copied: '복사됨', copyFailed: '복사 실패 — 브라우저에서 지원하지 않음', smallSaveNote: '이미 작아 압축할 필요가 거의 없습니다', smallSaveQuantNote: '이미 작지만 PNG 양자화를 시도해 보세요', alphaJpegNote: '투명 영역이 있습니다 — JPEG에서는 투명 부분이 흰색으로 채워집니다', useWebpBtn: 'WebP로 전환', gifFirstFrame: '첫 프레임만 유지', jpegFillLabel: 'JPEG 채우기 색상', keepOriginalNameLabel: '원본 파일 이름 유지(-compressed 접미사 없음)', resizeModeLabel: '크기 조정 방식', resizeLongest: '가장 긴 변', resizeWidth: '너비', resizeHeight: '높이', resizePercent: '백분율', resizeWidthLabel: '너비(픽셀, 0 = 크기 조정 안 함)', resizeHeightLabel: '높이(픽셀, 0 = 크기 조정 안 함)', resizePercentLabel: '크기 조정 백분율(%, 100 = 변경 없음)',
  decodeError: '이 이미지를 디코딩할 수 없습니다', formatError: '이 브라우저는 이 형식을 출력할 수 없습니다', compressFail: '압축에 실패했습니다',
  typeNoteWebp: '이 브라우저는 WebP 인코딩을 지원하지 않아 자동으로 JPEG으로 전환했습니다',
  targetBest: '최고 화질에서도 목표보다 작습니다', targetUnder: '이미 목표보다 작습니다', targetMin: '최소 크기까지 줄였지만 여전히 목표를 초과합니다', alreadyBest: '이미 최적, 원본 유지',
  targetAutoQ: (q) => `자동 화질 ${q}%`,
  targetAutoSize: (w, h) => `자동 크기 ${w}×${h}`,
  targetAutoSizeLow: (w, h) => `자동 크기 ${w}×${h}(최저 화질)`,
  sumBig: (s) => `−${s}%`,
  summaryDetail: (n, d, o, c) => `총 ${n}장 중 ${d}장 완료 · 원본 <span class="nw">${o}</span> → 압축 후 <span class="nw">${c}</span>`,
  sizes: (a, b) => `<span class="nw">${a}</span> → <span class="nw">${b}</span>`,
  processing: '처리 중…', dimsUnchanged: '(크기 변경 없음)',
  processingCount: (f, n) => `처리 중 ${f}/${n}장`,
  thumbHint: '썸네일을 클릭하면 미리보기', thumbTitle: '클릭하여 미리보기',
  tagOrig: '원본', tagComp: '압축 후', lbClose: '닫기', lbCompare: '드래그하여 원본과 압축본 비교', lbZoomHint: '구분선을 드래그하여 비교, 이미지를 클릭하면 맞춤 / 100% / 200% 전환', lbFit: '맞춤',
  btnDownload: '다운로드', btnRemove: '삭제',
  themeToDay: '주간 모드로 전환', themeToNight: '야간 모드로 전환', themeAria: '테마 전환',
  docTitle: '이미지 압축 - 100% 로컬 처리',
  metaDesc: '무료 오픈소스 이미지 압축 도구입니다. 모든 처리는 브라우저 안에서 이루어지며 이미지가 업로드되지 않습니다.',
  langAria: '표시 언어',
}

const fr: Messages = {
  appTitle: "Compresseur d'images", badgeLocal: '100 % local',
  headerSub: 'Les images ne quittent jamais votre appareil · Traitement par lots · Gratuit et open source', githubBtn: 'GitHub ↗',
  dropTitle: 'Glissez vos images ici, ou cliquez pour sélectionner', dropTitleTouch: 'Appuyez pour sélectionner des images',
  dropSub: 'Prend en charge JPG, PNG, WebP, GIF (première image), BMP, SVG, etc. Vous pouvez aussi coller avec Ctrl+V',
  dropSubTouch: 'Prend en charge JPG, PNG, WebP, GIF (première image), BMP, SVG, etc. Vous pouvez aussi coller des images directement',
  dropAria: 'Sélectionner des images', addMore: '+ Ajouter', addBtn: '+ Ajouter', dropAnywhere: 'Déposez pour ajouter des images',
  fmtLabel: 'Format de sortie', fmtOriginal: "Conserver l'original", fmtJpeg: 'JPEG (le plus léger, idéal pour les photos)',
  fmtPng: 'PNG (sans perte, idéal pour les captures)', fmtWebp: 'WebP (léger et fidèle, recommandé)', fmtAvif: 'AVIF (format nouvelle génération, encodage plus lent)',
  modeLabel: 'Mode de compression', modeQuality: 'Par qualité (manuel)', modeTarget: 'Par taille cible (auto)',
  targetLabel: 'Taille cible (Ko / par image)', qualityLabel: 'Qualité', maxLabel: 'Plus grand côté (px, 0 = pas de redimensionnement)',
  noUpscale: 'Ne pas agrandir (réduire seulement)', downloadAll: 'Tout télécharger', clearAll: 'Effacer la liste', presetLabel: 'Préréglages', preset_wechat: 'Image WeChat', preset_article: 'Image d’article WeChat', preset_idphoto: 'Photo d’identité ≤200KB', preset_website: 'Site web / Blog WebP 1600', preset_email: 'Pièce jointe ≤1 Mo', presetCancelTitle: 'Cliquer à nouveau pour annuler', clearConfirm: 'Confirmer l’effacement ?', allBestNote: (n) => `${n} images non compressées, les originaux seront conservés`, filteredNote: (n) => `${n} fichiers non images ignorés`,
  footer: 'Confidentialité : la compression supprime la géolocalisation et les autres métadonnées ; rien n’est téléversé.',
  pngHint: 'Le PNG est sans perte, le réglage de qualité n\'a donc aucun effet et le curseur est verrouillé', pngQuantHint: 'Avec la quantification, le curseur de qualité règle la qualité de la palette', quantizeLabel: 'Quantification palette PNG (avec perte, plus petit)', keepExifLabel: 'Conserver les métadonnées (JPEG uniquement)', fmtJpegNote: 'Le JPEG ne gère pas la transparence : les zones transparentes sont remplies en blanc', fmtWebpNote: 'Si le navigateur ne peut pas encoder en WebP, il bascule automatiquement vers JPEG', modeTargetNote: 'Mode taille cible : la qualité est d’abord ajustée, puis les dimensions, jusqu’à atteindre la cible', shareBtn: 'Partager', copyBtn: 'Copier l’image', copied: 'Copié', copyFailed: 'Échec de la copie — navigateur non pris en charge', smallSaveNote: 'Déjà petit — à peine utile à compresser', smallSaveQuantNote: 'Déjà petit — essayez la quantification PNG', alphaJpegNote: 'Contient de la transparence — le JPEG remplit les zones transparentes en blanc', useWebpBtn: 'Passer en WebP', gifFirstFrame: 'Première image seulement', jpegFillLabel: 'Couleur de remplissage JPEG', keepOriginalNameLabel: 'Garder le nom d’origine (sans suffixe -compressed)', resizeModeLabel: 'Redimensionner par', resizeLongest: 'Côté le plus long', resizeWidth: 'Largeur', resizeHeight: 'Hauteur', resizePercent: 'Pourcentage', resizeWidthLabel: 'Largeur (px, 0 = pas de redimensionnement)', resizeHeightLabel: 'Hauteur (px, 0 = pas de redimensionnement)', resizePercentLabel: 'Pourcentage de mise à l’échelle (%, 100 = inchangé)',
  decodeError: 'Impossible de décoder cette image', formatError: 'Ce navigateur ne peut pas encoder ce format', compressFail: 'Échec de la compression',
  typeNoteWebp: 'Ce navigateur ne peut pas encoder en WebP, bascule automatique vers JPEG',
  targetBest: 'Déjà à la meilleure qualité, toujours sous la cible', targetUnder: 'Déjà sous la cible', targetMin: 'Déjà à la taille minimale, toujours au-dessus de la cible', alreadyBest: 'Déjà optimal, original conservé',
  targetAutoQ: (q) => `Qualité auto ${q} %`,
  targetAutoSize: (w, h) => `Taille auto ${w}×${h}`,
  targetAutoSizeLow: (w, h) => `Taille auto ${w}×${h} (qualité minimale)`,
  sumBig: (s) => `−${s} %`,
  summaryDetail: (n, d, o, c) => `${n} images, ${d} terminées · Original <span class="nw">${o}</span> → Compressé <span class="nw">${c}</span>`,
  sizes: (a, b) => `<span class="nw">${a}</span> → <span class="nw">${b}</span>`,
  processing: 'Traitement…', dimsUnchanged: '(inchangé)',
  processingCount: (f, n) => `Traitement ${f}/${n}`,
  thumbHint: 'Cliquez sur la miniature pour prévisualiser', thumbTitle: 'Cliquer pour prévisualiser',
  tagOrig: 'Original', tagComp: 'Compressée', lbClose: 'Fermer', lbCompare: 'Faire glisser pour comparer l’original et la version compressée', lbZoomHint: 'Faites glisser le séparateur pour comparer, cliquez sur l’image pour basculer entre ajusté / 100 % / 200 %', lbFit: 'Ajusté',
  btnDownload: 'Télécharger', btnRemove: 'Retirer',
  themeToDay: 'Passer en mode jour', themeToNight: 'Passer en mode nuit', themeAria: 'Changer de thème',
  docTitle: "Compresseur d'images - 100 % local",
  metaDesc: 'Outil gratuit et open source de compression d\'images. Tout s\'exécute localement dans votre navigateur — les images ne sont jamais envoyées.',
  langAria: "Langue d'affichage",
}

const de: Messages = {
  appTitle: 'Bildkomprimierung', badgeLocal: '100 % lokal',
  headerSub: 'Bilder verlassen Ihr Gerät nicht · Stapelverarbeitung · Kostenlos & Open Source', githubBtn: 'GitHub ↗',
  dropTitle: 'Bilder hierher ziehen oder klicken, um auszuwählen', dropTitleTouch: 'Tippen, um Bilder auszuwählen',
  dropSub: 'Unterstützt JPG, PNG, WebP, GIF (erstes Bild), BMP, SVG u. a. Auch per Strg+V einfügen möglich',
  dropSubTouch: 'Unterstützt JPG, PNG, WebP, GIF (erstes Bild), BMP, SVG u. a. Bilder können auch direkt eingefügt werden',
  dropAria: 'Bilder auswählen', addMore: '+ Weitere hinzufügen', addBtn: '+ Hinzufügen', dropAnywhere: 'Loslassen, um Bilder hinzuzufügen',
  fmtLabel: 'Ausgabeformat', fmtOriginal: 'Original beibehalten', fmtJpeg: 'JPEG (kleinste Datei, ideal für Fotos)',
  fmtPng: 'PNG (verlustfrei, ideal für Screenshots)', fmtWebp: 'WebP (klein und hochwertig, empfohlen)', fmtAvif: 'AVIF (Format der nächsten Generation, langsamer)',
  modeLabel: 'Komprimierungsmodus', modeQuality: 'Nach Qualität (manuell)', modeTarget: 'Nach Zielgröße (automatisch)',
  targetLabel: 'Zielgröße (KB / pro Bild)', qualityLabel: 'Qualität', maxLabel: 'Längste Seite (px, 0 = keine Skalierung)',
  noUpscale: 'Nicht vergrößern (nur verkleinern)', downloadAll: 'Alle herunterladen', clearAll: 'Liste leeren', presetLabel: 'Presets', preset_wechat: 'WeChat-Bild', preset_article: 'WeChat-Artikelbild', preset_idphoto: 'Passfoto ≤200KB', preset_website: 'Website / Blog WebP 1600', preset_email: 'E-Mail-Anhang ≤1 MB', presetCancelTitle: 'Erneut klicken zum Aufheben', clearConfirm: 'Löschen bestätigen?', allBestNote: (n) => `${n} Bilder unkomprimiert, Originale werden behalten`, filteredNote: (n) => `${n} Nicht-Bilddateien übersprungen`,
  footer: 'Datenschutz: Beim Komprimieren werden Standort- und andere Metadaten entfernt; nichts wird hochgeladen.',
  pngHint: 'PNG ist verlustfrei, daher hat die Qualitätseinstellung keine Wirkung und der Regler ist gesperrt', pngQuantHint: 'Bei aktiver Quantisierung steuert der Qualitätsregler die Palettenqualität', quantizeLabel: 'PNG-Palettenquantisierung (verlustbehaftet, kleiner)', keepExifLabel: 'Metadaten behalten (nur JPEG)', fmtJpegNote: 'JPEG unterstützt keine Transparenz — transparente Bereiche werden weiß gefüllt', fmtWebpNote: 'Kann der Browser kein WebP encodieren, wird automatisch auf JPEG umgestellt', modeTargetNote: 'Zielgrößen-Modus: Zuerst wird die Qualität, dann die Abmessung automatisch angepasst, bis die Zielgröße erreicht ist', shareBtn: 'Teilen', copyBtn: 'Bild kopieren', copied: 'Kopiert', copyFailed: 'Kopieren fehlgeschlagen — Browser unterstützt dies nicht', smallSaveNote: 'Bereits klein — kaum lohnenswert zu komprimieren', smallSaveQuantNote: 'Bereits klein — PNG-Quantisierung ausprobieren', alphaJpegNote: 'Enthält Transparenz — JPEG füllt transparente Bereiche weiß', useWebpBtn: 'Zu WebP wechseln', gifFirstFrame: 'Nur erstes Bild', jpegFillLabel: 'JPEG-Füllfarbe', keepOriginalNameLabel: 'Originaldateiname behalten (ohne -compressed-Suffix)', resizeModeLabel: 'Skalieren nach', resizeLongest: 'Längste Seite', resizeWidth: 'Breite', resizeHeight: 'Höhe', resizePercent: 'Prozent', resizeWidthLabel: 'Breite (px, 0 = keine Skalierung)', resizeHeightLabel: 'Höhe (px, 0 = keine Skalierung)', resizePercentLabel: 'Skalierungsprozent (%, 100 = unverändert)',
  decodeError: 'Dieses Bild kann nicht decodiert werden', formatError: 'Dieser Browser kann dieses Format nicht encodieren', compressFail: 'Komprimierung fehlgeschlagen',
  typeNoteWebp: 'Dieser Browser kann kein WebP encodieren, automatisch auf JPEG umgestellt',
  targetBest: 'Bereits bei bester Qualität, trotzdem unter dem Ziel', targetUnder: 'Bereits unter dem Ziel', targetMin: 'Bereits bei Mindestgröße, trotzdem über dem Ziel', alreadyBest: 'Bereits optimal, Original behalten',
  targetAutoQ: (q) => `Auto-Qualität ${q} %`,
  targetAutoSize: (w, h) => `Auto-Größe ${w}×${h}`,
  targetAutoSizeLow: (w, h) => `Auto-Größe ${w}×${h} (niedrigste Qualität)`,
  sumBig: (s) => `−${s} %`,
  summaryDetail: (n, d, o, c) => `${n} Bilder, ${d} fertig · Original <span class="nw">${o}</span> → Komprimiert <span class="nw">${c}</span>`,
  sizes: (a, b) => `<span class="nw">${a}</span> → <span class="nw">${b}</span>`,
  processing: 'Wird verarbeitet…', dimsUnchanged: '(unverändert)',
  processingCount: (f, n) => `Verarbeite ${f}/${n}`,
  thumbHint: 'Miniatur anklicken für Vorschau', thumbTitle: 'Anklicken für Vorschau',
  tagOrig: 'Original', tagComp: 'Komprimiert', lbClose: 'Schließen', lbCompare: 'Ziehen, um Original und komprimierte Version zu vergleichen', lbZoomHint: 'Trennlinie ziehen zum Vergleichen, Bild anklicken für Anpassen / 100 % / 200 %', lbFit: 'Anpassen',
  btnDownload: 'Herunterladen', btnRemove: 'Entfernen',
  themeToDay: 'Zum hellen Modus wechseln', themeToNight: 'Zum dunklen Modus wechseln', themeAria: 'Design wechseln',
  docTitle: 'Bildkomprimierung - 100 % lokal',
  metaDesc: 'Kostenloses Open-Source-Tool zur Bildkomprimierung. Alles läuft lokal in Ihrem Browser — Bilder werden nie hochgeladen.',
  langAria: 'Anzeigesprache',
}

export const MESSAGES: Record<Lang, Messages> = { zh, en, ja, ko, fr, de }

// Guard: every language must define every key the default (zh) defines.
const baseKeys = Object.keys(zh).sort()
for (const code of Object.keys(MESSAGES) as Lang[]) {
  const missing = baseKeys.filter((k) => !(k in MESSAGES[code]))
  if (missing.length) throw new Error(`i18n ${code} missing keys: ${missing.join(', ')}`)
}

export function detectLang(): Lang {
  const l = (navigator.language || '').toLowerCase()
  for (const { code } of LANGS) {
    if (l.startsWith(code)) return code
  }
  return 'en'
}

export function initialLang(): Lang {
  try {
    const stored = localStorage.getItem('ic-lang') as Lang | null
    if (stored && stored in MESSAGES) return stored
  } catch { /* ignore */ }
  return detectLang()
}

export function t(lang: Lang, key: string, ...args: (string | number)[]): string {
  const v = MESSAGES[lang][key]
  if (typeof v === 'function') return v(...args)
  return v
}
