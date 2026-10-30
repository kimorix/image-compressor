// Format converter strings, kept inside the feature (this chunk only loads
// with the convert page; the shared dictionary stays light). Same six
// languages as the app; English is the fallback for a missing key, and a
// unit test pins that every language has every key.
import type { Lang } from '../../shared/i18n'

type Fn = (...args: (string | number)[]) => string
type Messages = Record<string, string | Fn>

const zh: Messages = {
  title: '格式转换', sub: '本地转换 · 文件不上传', docTitle: '图片格式转换 - HEIC / WebP / AVIF / PNG / JPEG 本地互转', metaDesc: '免费的图片格式转换工具：HEIC 转 JPG、WebP 转 JPG、PNG 转 WebP 等。所有转换都在浏览器本地完成，文件不会上传。',
  dropTitle: '拖入、粘贴或选择图片', dropTitleTouch: '选择图片', dropSub: '支持批量和整个文件夹 · 文件只在你的浏览器里处理，不会上传', dropSubTouch: '文件只在本机处理，不会上传', dropAria: '选择图片文件', addMore: '+ 添加图片', dropAnywhere: '松开添加图片', pickFolder: '选择文件夹',
  notImage: (n) => `已跳过 ${n} 个非图片文件`, dupSkipped: (n) => `已跳过 ${n} 个重复文件`, pasteEmpty: '剪贴板里没有图片',
  listTitle: '转换列表', count: (n) => `${n} 张`, clear: '清空', clearConfirm: '确认清空？', reconvert: '重新转换', downloadAll: '全部下载 .zip', saveAll: '全部存储 / 下载', zipping: '正在打包…', start: '开始转换', startN: (n) => `开始转换（${n}）`,
  stripDone: '已完成', stripRunning: '转换中', stripFailed: '失败', stripUnsupported: '不支持', stripTotal: (a, b) => `共 ${a} → ${b}`,
  stQueued: '排队中', stConverting: '转换中', stDone: '已完成', stFailed: '失败', stUnsupported: '不支持', stCancelled: '已取消', stStale: '设置已更改',
  download: (ext) => `下载 .${ext}`, cancel: '取消', remove: '删除', retry: '重试', close: '关闭', openDetails: '查看详情',
  settingsTitle: '转换设置', outFormat: '输出格式', fmtAuto: '自动', fmtHintAuto: '按来源推荐：HEIC 和照片转 JPEG，透明 PNG 转 WebP。', fmtHintJpeg: '兼容性最好，适合照片；不支持透明。', fmtHintPng: '无损，适合截图、图标；体积较大。', fmtHintWebp: '网页常用，体积小，支持透明。', fmtHintAvif: '体积最小，编码较慢；部分旧软件打不开。',
  quality: '质量', smaller: '更小', sharper: '更清晰', pngLossless: 'PNG 为无损格式，不需要设置质量。', qualityAuto: (j, w) => `自动时：JPEG ${j} · WebP ${w}`,
  fill: '透明区域填充', fillHint: '仅在透明图片转 JPEG 时生效。', fillWhite: '白色', fillBlack: '黑色', fillGray: '浅灰', fillHexAria: '填充颜色（十六进制）',
  keepExif: '保留 EXIF（拍摄信息）', keepExifHint: '含相机、时间；GPS 位置始终移除。', keepName: '文件名保持不变', keepNameHint: '关闭时文件名加 -converted 后缀。',
  noteFilled: (hex) => `透明区已填充 ${hex}`, noteFirstFrame: '动图 · 仅取首帧', noteExifKept: '已保留 EXIF · GPS 已移除', noteExifAvif: 'AVIF 不保留 EXIF', noteSameFormat: (q) => `格式相同，已按质量 ${q} 重新编码`, noteAvifSlow: 'AVIF 编码较慢，请稍候', noteP3: '已保留 Display P3 色彩',
  errDecode: '无法解码：文件可能已损坏', errAvifDecode: '无法解码：文件可能已损坏，或当前浏览器不支持 AVIF 解码', errHeic: 'HEIC 解码失败，可以重试', errTooLarge: '图片像素过多（超过 8000 万像素），请先缩小', errEncode: '编码失败：当前浏览器无法输出这个格式', errFailed: '转换失败，请重试',
  unsupportedHint: (f) => `暂不支持 ${f} 输入，已跳过。`, unsupportedShort: (f) => `暂不支持 ${f}`,
  sideTitle: '支持的格式', sideIn: '输入：JPEG · PNG · WebP · AVIF · GIF（首帧）· HEIC/HEIF · BMP', sideOut: '输出：JPEG · PNG · WebP · AVIF',
  guideTitle: '怎么选格式', guideJpeg: 'JPEG：照片、发给任何人', guidePng: 'PNG：截图、图标、需要无损', guideWebp: 'WebP：网页用，体积小，支持透明', guideAvif: 'AVIF：体积最小，编码较慢',
  sumOut: '输出', sumQuality: (q) => `质量 ${q}`, sumExif: '保留 EXIF', sumChange: '更改',
  detailOrig: '原文件', detailOut: '转换后', detailSize: '体积', detailExif: 'EXIF', detailNote: '提示', origLabel: (f) => `原图 ${f}`,
  exifNone: '原图无 EXIF', exifOff: '未保留', exifKept: '已保留（GPS 已移除）', exifAvif: 'AVIF 不写入 EXIF',
  changeTo: (f) => `改为 ${f}`, share: (ext) => `分享 / 存储 .${ext}`, qualityN: (q) => `质量 ${q}`, lossless: '无损',
}

const en: Messages = {
  title: 'Convert format', sub: 'Converted locally · Never uploaded', docTitle: 'Image format converter - HEIC / WebP / AVIF / PNG / JPEG, locally', metaDesc: 'Free image format converter: HEIC to JPG, WebP to JPG, PNG to WebP and more. Everything runs in your browser; files are never uploaded.',
  dropTitle: 'Drop, paste or choose images', dropTitleTouch: 'Choose images', dropSub: 'Batches and whole folders · Processed only in your browser, never uploaded', dropSubTouch: 'Processed on this device, never uploaded', dropAria: 'Choose image files', addMore: '+ Add images', dropAnywhere: 'Drop to add images', pickFolder: 'Choose a folder',
  notImage: (n) => `Skipped ${n} non-image files`, dupSkipped: (n) => `Skipped ${n} duplicate files`, pasteEmpty: 'No image in the clipboard',
  listTitle: 'Conversions', count: (n) => `${n} ${Number(n) === 1 ? 'image' : 'images'}`, clear: 'Clear', clearConfirm: 'Clear all?', reconvert: 'Convert again', downloadAll: 'Download all .zip', saveAll: 'Save / download all', zipping: 'Zipping…', start: 'Convert', startN: (n) => `Convert (${n})`,
  stripDone: 'Done', stripRunning: 'Converting', stripFailed: 'Failed', stripUnsupported: 'Unsupported', stripTotal: (a, b) => `Total ${a} → ${b}`,
  stQueued: 'Queued', stConverting: 'Converting', stDone: 'Done', stFailed: 'Failed', stUnsupported: 'Unsupported', stCancelled: 'Cancelled', stStale: 'Settings changed',
  download: (ext) => `Download .${ext}`, cancel: 'Cancel', remove: 'Remove', retry: 'Retry', close: 'Close', openDetails: 'Details',
  settingsTitle: 'Conversion settings', outFormat: 'Output format', fmtAuto: 'Auto', fmtHintAuto: 'Picked per file: HEIC and photos become JPEG, transparent PNGs become WebP.', fmtHintJpeg: 'Opens everywhere, best for photos; no transparency.', fmtHintPng: 'Lossless, for screenshots and icons; larger files.', fmtHintWebp: 'Made for the web: small, keeps transparency.', fmtHintAvif: 'Smallest files, slow to encode; some older apps cannot open it.',
  quality: 'Quality', smaller: 'Smaller', sharper: 'Sharper', pngLossless: 'PNG is lossless, so there is no quality to set.', qualityAuto: (j, w) => `When auto: JPEG ${j} · WebP ${w}`,
  fill: 'Transparent areas', fillHint: 'Only used when a transparent image becomes JPEG.', fillWhite: 'White', fillBlack: 'Black', fillGray: 'Light grey', fillHexAria: 'Fill colour (hex)',
  keepExif: 'Keep EXIF (camera info)', keepExifHint: 'Camera and date are kept; GPS location is always removed.', keepName: 'Keep file names', keepNameHint: 'When off, names get a -converted suffix.',
  noteFilled: (hex) => `Transparency filled with ${hex}`, noteFirstFrame: 'Animated · first frame only', noteExifKept: 'EXIF kept · GPS removed', noteExifAvif: 'AVIF does not keep EXIF', noteSameFormat: (q) => `Same format, re-encoded at quality ${q}`, noteAvifSlow: 'AVIF is slow to encode, please wait', noteP3: 'Display P3 colour kept',
  errDecode: 'Cannot decode: the file may be damaged', errAvifDecode: 'Cannot decode: the file may be damaged, or this browser cannot decode AVIF', errHeic: 'HEIC decoding failed, you can retry', errTooLarge: 'Too many pixels (over 80 megapixels); resize it first', errEncode: 'Encoding failed: this browser cannot write this format', errFailed: 'Conversion failed, please retry',
  unsupportedHint: (f) => `${f} input is not supported yet; skipped.`, unsupportedShort: (f) => `${f} not supported`,
  sideTitle: 'Supported formats', sideIn: 'In: JPEG · PNG · WebP · AVIF · GIF (first frame) · HEIC/HEIF · BMP', sideOut: 'Out: JPEG · PNG · WebP · AVIF',
  guideTitle: 'Which format?', guideJpeg: 'JPEG: photos, sending to anyone', guidePng: 'PNG: screenshots, icons, lossless', guideWebp: 'WebP: the web, small, transparency', guideAvif: 'AVIF: smallest, slower to encode',
  sumOut: 'Output', sumQuality: (q) => `quality ${q}`, sumExif: 'keep EXIF', sumChange: 'Change',
  detailOrig: 'Original', detailOut: 'Converted', detailSize: 'Size', detailExif: 'EXIF', detailNote: 'Note', origLabel: (f) => `Original ${f}`,
  exifNone: 'Original has no EXIF', exifOff: 'Not kept', exifKept: 'Kept (GPS removed)', exifAvif: 'AVIF does not carry EXIF',
  changeTo: (f) => `Make it ${f}`, share: (ext) => `Share / save .${ext}`, qualityN: (q) => `quality ${q}`, lossless: 'lossless',
}

const ja: Messages = {
  title: '形式変換', sub: 'ローカル変換 · アップロードなし', docTitle: '画像形式変換 - HEIC / WebP / AVIF / PNG / JPEG をローカルで', metaDesc: '無料の画像形式変換ツール：HEIC→JPG、WebP→JPG、PNG→WebP など。すべてブラウザ内で処理され、アップロードされません。',
  dropTitle: '画像をドロップ・貼り付け・選択', dropTitleTouch: '画像を選択', dropSub: '一括・フォルダごと対応 · ブラウザ内だけで処理し、アップロードしません', dropSubTouch: 'この端末だけで処理し、アップロードしません', dropAria: '画像ファイルを選択', addMore: '+ 画像を追加', dropAnywhere: '離して画像を追加', pickFolder: 'フォルダを選択',
  notImage: (n) => `画像以外のファイル ${n} 件をスキップしました`, dupSkipped: (n) => `重複ファイル ${n} 件をスキップしました`, pasteEmpty: 'クリップボードに画像がありません',
  listTitle: '変換リスト', count: (n) => `${n} 枚`, clear: 'クリア', clearConfirm: 'すべて消去？', reconvert: '再変換', downloadAll: 'すべてダウンロード .zip', saveAll: 'すべて保存 / ダウンロード', zipping: '圧縮中…', start: '変換開始', startN: (n) => `変換開始（${n}）`,
  stripDone: '完了', stripRunning: '変換中', stripFailed: '失敗', stripUnsupported: '非対応', stripTotal: (a, b) => `合計 ${a} → ${b}`,
  stQueued: '待機中', stConverting: '変換中', stDone: '完了', stFailed: '失敗', stUnsupported: '非対応', stCancelled: 'キャンセル済み', stStale: '設定が変更されました',
  download: (ext) => `.${ext} をダウンロード`, cancel: 'キャンセル', remove: '削除', retry: '再試行', close: '閉じる', openDetails: '詳細',
  settingsTitle: '変換設定', outFormat: '出力形式', fmtAuto: '自動', fmtHintAuto: 'ファイルごとに推奨：HEIC と写真は JPEG、透過 PNG は WebP。', fmtHintJpeg: '互換性が最も高く写真向き。透過は不可。', fmtHintPng: '可逆圧縮。スクリーンショットやアイコン向き。サイズは大きめ。', fmtHintWebp: 'Web 向け。小さく、透過も保持。', fmtHintAvif: '最小サイズ。エンコードは遅め。古いアプリでは開けないことも。',
  quality: '画質', smaller: '小さく', sharper: '鮮明に', pngLossless: 'PNG は可逆形式なので画質の設定はありません。', qualityAuto: (j, w) => `自動時：JPEG ${j} · WebP ${w}`,
  fill: '透過部分の塗り', fillHint: '透過画像を JPEG にするときだけ使います。', fillWhite: '白', fillBlack: '黒', fillGray: 'ライトグレー', fillHexAria: '塗りの色（16 進）',
  keepExif: 'EXIF（撮影情報）を保持', keepExifHint: 'カメラや日時を保持。GPS 位置情報は常に削除します。', keepName: 'ファイル名を変えない', keepNameHint: 'オフにすると名前に -converted を付けます。',
  noteFilled: (hex) => `透過部分を ${hex} で塗りました`, noteFirstFrame: 'アニメーション · 最初のフレームのみ', noteExifKept: 'EXIF を保持 · GPS は削除', noteExifAvif: 'AVIF には EXIF を保持しません', noteSameFormat: (q) => `同じ形式のため画質 ${q} で再エンコード`, noteAvifSlow: 'AVIF のエンコードは時間がかかります', noteP3: 'Display P3 の色を保持',
  errDecode: 'デコードできません：ファイルが壊れている可能性があります', errAvifDecode: 'デコードできません：ファイルが壊れているか、このブラウザは AVIF をデコードできません', errHeic: 'HEIC のデコードに失敗しました。再試行できます', errTooLarge: '画素数が多すぎます（8000 万画素超）。先に縮小してください', errEncode: 'エンコード失敗：このブラウザはこの形式を書き出せません', errFailed: '変換に失敗しました。再試行してください',
  unsupportedHint: (f) => `${f} の入力にはまだ対応していないため、スキップしました。`, unsupportedShort: (f) => `${f} は非対応`,
  sideTitle: '対応形式', sideIn: '入力：JPEG · PNG · WebP · AVIF · GIF（最初のフレーム）· HEIC/HEIF · BMP', sideOut: '出力：JPEG · PNG · WebP · AVIF',
  guideTitle: '形式の選び方', guideJpeg: 'JPEG：写真、誰にでも送れる', guidePng: 'PNG：スクリーンショット、アイコン、可逆', guideWebp: 'WebP：Web 用、小さい、透過対応', guideAvif: 'AVIF：最小、エンコードは遅め',
  sumOut: '出力', sumQuality: (q) => `画質 ${q}`, sumExif: 'EXIF 保持', sumChange: '変更',
  detailOrig: '元ファイル', detailOut: '変換後', detailSize: 'サイズ', detailExif: 'EXIF', detailNote: 'ヒント', origLabel: (f) => `元画像 ${f}`,
  exifNone: '元画像に EXIF なし', exifOff: '保持しない', exifKept: '保持（GPS は削除）', exifAvif: 'AVIF には EXIF を書き込みません',
  changeTo: (f) => `${f} にする`, share: (ext) => `共有 / 保存 .${ext}`, qualityN: (q) => `画質 ${q}`, lossless: '可逆',
}

const ko: Messages = {
  title: '형식 변환', sub: '로컬 변환 · 업로드 없음', docTitle: '이미지 형식 변환 - HEIC / WebP / AVIF / PNG / JPEG 로컬 변환', metaDesc: '무료 이미지 형식 변환 도구: HEIC→JPG, WebP→JPG, PNG→WebP 등. 모든 변환은 브라우저 안에서 처리되며 업로드되지 않습니다.',
  dropTitle: '이미지를 끌어 놓기·붙여넣기·선택', dropTitleTouch: '이미지 선택', dropSub: '일괄 처리와 폴더 전체 지원 · 브라우저에서만 처리하며 업로드하지 않습니다', dropSubTouch: '이 기기에서만 처리하며 업로드하지 않습니다', dropAria: '이미지 파일 선택', addMore: '+ 이미지 추가', dropAnywhere: '놓아서 이미지 추가', pickFolder: '폴더 선택',
  notImage: (n) => `이미지가 아닌 파일 ${n}개를 건너뛰었습니다`, dupSkipped: (n) => `중복 파일 ${n}개를 건너뛰었습니다`, pasteEmpty: '클립보드에 이미지가 없습니다',
  listTitle: '변환 목록', count: (n) => `${n}장`, clear: '비우기', clearConfirm: '모두 지울까요?', reconvert: '다시 변환', downloadAll: '모두 다운로드 .zip', saveAll: '모두 저장 / 다운로드', zipping: '압축 중…', start: '변환 시작', startN: (n) => `변환 시작 (${n})`,
  stripDone: '완료', stripRunning: '변환 중', stripFailed: '실패', stripUnsupported: '미지원', stripTotal: (a, b) => `합계 ${a} → ${b}`,
  stQueued: '대기 중', stConverting: '변환 중', stDone: '완료', stFailed: '실패', stUnsupported: '미지원', stCancelled: '취소됨', stStale: '설정 변경됨',
  download: (ext) => `.${ext} 다운로드`, cancel: '취소', remove: '삭제', retry: '다시 시도', close: '닫기', openDetails: '상세',
  settingsTitle: '변환 설정', outFormat: '출력 형식', fmtAuto: '자동', fmtHintAuto: '파일별 추천: HEIC와 사진은 JPEG, 투명 PNG는 WebP.', fmtHintJpeg: '호환성이 가장 좋고 사진에 적합; 투명 미지원.', fmtHintPng: '무손실, 스크린샷·아이콘용; 용량이 큼.', fmtHintWebp: '웹용, 작고 투명 지원.', fmtHintAvif: '가장 작음, 인코딩이 느림; 일부 오래된 앱은 열지 못함.',
  quality: '품질', smaller: '더 작게', sharper: '더 선명하게', pngLossless: 'PNG는 무손실이라 품질 설정이 없습니다.', qualityAuto: (j, w) => `자동일 때: JPEG ${j} · WebP ${w}`,
  fill: '투명 영역 채우기', fillHint: '투명 이미지를 JPEG로 바꿀 때만 사용됩니다.', fillWhite: '흰색', fillBlack: '검정', fillGray: '연회색', fillHexAria: '채우기 색 (16진수)',
  keepExif: 'EXIF(촬영 정보) 유지', keepExifHint: '카메라·시간은 유지하고 GPS 위치는 항상 제거합니다.', keepName: '파일 이름 유지', keepNameHint: '끄면 이름에 -converted 가 붙습니다.',
  noteFilled: (hex) => `투명 영역을 ${hex}(으)로 채움`, noteFirstFrame: '움짤 · 첫 프레임만', noteExifKept: 'EXIF 유지 · GPS 제거', noteExifAvif: 'AVIF는 EXIF를 유지하지 않음', noteSameFormat: (q) => `같은 형식, 품질 ${q}(으)로 다시 인코딩`, noteAvifSlow: 'AVIF 인코딩은 시간이 걸립니다', noteP3: 'Display P3 색상 유지',
  errDecode: '디코딩 불가: 파일이 손상되었을 수 있습니다', errAvifDecode: '디코딩 불가: 파일이 손상되었거나 이 브라우저가 AVIF를 디코딩하지 못합니다', errHeic: 'HEIC 디코딩 실패, 다시 시도할 수 있습니다', errTooLarge: '픽셀 수가 너무 많습니다(8000만 화소 초과). 먼저 줄여 주세요', errEncode: '인코딩 실패: 이 브라우저는 이 형식을 쓸 수 없습니다', errFailed: '변환 실패, 다시 시도해 주세요',
  unsupportedHint: (f) => `${f} 입력은 아직 지원하지 않아 건너뛰었습니다.`, unsupportedShort: (f) => `${f} 미지원`,
  sideTitle: '지원 형식', sideIn: '입력: JPEG · PNG · WebP · AVIF · GIF(첫 프레임) · HEIC/HEIF · BMP', sideOut: '출력: JPEG · PNG · WebP · AVIF',
  guideTitle: '형식 고르기', guideJpeg: 'JPEG: 사진, 누구에게나 보내기', guidePng: 'PNG: 스크린샷, 아이콘, 무손실', guideWebp: 'WebP: 웹용, 작음, 투명 지원', guideAvif: 'AVIF: 가장 작음, 인코딩 느림',
  sumOut: '출력', sumQuality: (q) => `품질 ${q}`, sumExif: 'EXIF 유지', sumChange: '변경',
  detailOrig: '원본', detailOut: '변환 후', detailSize: '용량', detailExif: 'EXIF', detailNote: '안내', origLabel: (f) => `원본 ${f}`,
  exifNone: '원본에 EXIF 없음', exifOff: '유지 안 함', exifKept: '유지됨(GPS 제거)', exifAvif: 'AVIF에는 EXIF를 쓰지 않음',
  changeTo: (f) => `${f}(으)로 바꾸기`, share: (ext) => `공유 / 저장 .${ext}`, qualityN: (q) => `품질 ${q}`, lossless: '무손실',
}

const de: Messages = {
  title: 'Format umwandeln', sub: 'Lokal umgewandelt · Kein Upload', docTitle: 'Bildformat umwandeln - HEIC / WebP / AVIF / PNG / JPEG, lokal', metaDesc: 'Kostenloser Bildformat-Konverter: HEIC zu JPG, WebP zu JPG, PNG zu WebP und mehr. Alles läuft im Browser; Dateien werden nie hochgeladen.',
  dropTitle: 'Bilder ablegen, einfügen oder auswählen', dropTitleTouch: 'Bilder auswählen', dropSub: 'Stapel und ganze Ordner · Nur in deinem Browser verarbeitet, nie hochgeladen', dropSubTouch: 'Auf diesem Gerät verarbeitet, nie hochgeladen', dropAria: 'Bilddateien auswählen', addMore: '+ Bilder hinzufügen', dropAnywhere: 'Loslassen zum Hinzufügen', pickFolder: 'Ordner auswählen',
  notImage: (n) => `${n} Nicht-Bild-Dateien übersprungen`, dupSkipped: (n) => `${n} doppelte Dateien übersprungen`, pasteEmpty: 'Kein Bild in der Zwischenablage',
  listTitle: 'Umwandlungen', count: (n) => `${n} ${Number(n) === 1 ? 'Bild' : 'Bilder'}`, clear: 'Leeren', clearConfirm: 'Alles leeren?', reconvert: 'Neu umwandeln', downloadAll: 'Alle laden .zip', saveAll: 'Alle sichern / laden', zipping: 'Wird gepackt…', start: 'Umwandeln', startN: (n) => `Umwandeln (${n})`,
  stripDone: 'Fertig', stripRunning: 'Läuft', stripFailed: 'Fehler', stripUnsupported: 'Nicht unterstützt', stripTotal: (a, b) => `Gesamt ${a} → ${b}`,
  stQueued: 'Wartet', stConverting: 'Wird umgewandelt', stDone: 'Fertig', stFailed: 'Fehler', stUnsupported: 'Nicht unterstützt', stCancelled: 'Abgebrochen', stStale: 'Einstellungen geändert',
  download: (ext) => `.${ext} laden`, cancel: 'Abbrechen', remove: 'Entfernen', retry: 'Erneut', close: 'Schließen', openDetails: 'Details',
  settingsTitle: 'Einstellungen', outFormat: 'Ausgabeformat', fmtAuto: 'Auto', fmtHintAuto: 'Pro Datei gewählt: HEIC und Fotos werden JPEG, transparente PNGs WebP.', fmtHintJpeg: 'Öffnet überall, ideal für Fotos; keine Transparenz.', fmtHintPng: 'Verlustfrei, für Screenshots und Icons; größere Dateien.', fmtHintWebp: 'Fürs Web: klein, behält Transparenz.', fmtHintAvif: 'Kleinste Dateien, langsam zu kodieren; manche ältere Apps öffnen es nicht.',
  quality: 'Qualität', smaller: 'Kleiner', sharper: 'Schärfer', pngLossless: 'PNG ist verlustfrei, es gibt keine Qualität einzustellen.', qualityAuto: (j, w) => `Bei Auto: JPEG ${j} · WebP ${w}`,
  fill: 'Transparente Bereiche', fillHint: 'Nur wenn ein transparentes Bild zu JPEG wird.', fillWhite: 'Weiß', fillBlack: 'Schwarz', fillGray: 'Hellgrau', fillHexAria: 'Füllfarbe (Hex)',
  keepExif: 'EXIF behalten (Kameradaten)', keepExifHint: 'Kamera und Datum bleiben; der GPS-Standort wird immer entfernt.', keepName: 'Dateinamen behalten', keepNameHint: 'Aus: Namen bekommen das Suffix -converted.',
  noteFilled: (hex) => `Transparenz mit ${hex} gefüllt`, noteFirstFrame: 'Animiert · nur erstes Bild', noteExifKept: 'EXIF behalten · GPS entfernt', noteExifAvif: 'AVIF behält kein EXIF', noteSameFormat: (q) => `Gleiches Format, neu kodiert mit Qualität ${q}`, noteAvifSlow: 'AVIF braucht etwas länger', noteP3: 'Display-P3-Farben behalten',
  errDecode: 'Nicht dekodierbar: Datei evtl. beschädigt', errAvifDecode: 'Nicht dekodierbar: Datei beschädigt oder dieser Browser kann kein AVIF dekodieren', errHeic: 'HEIC-Dekodierung fehlgeschlagen, erneut versuchen möglich', errTooLarge: 'Zu viele Pixel (über 80 Megapixel); bitte erst verkleinern', errEncode: 'Kodierung fehlgeschlagen: Dieser Browser kann das Format nicht schreiben', errFailed: 'Umwandlung fehlgeschlagen, bitte erneut',
  unsupportedHint: (f) => `${f} wird als Eingabe noch nicht unterstützt; übersprungen.`, unsupportedShort: (f) => `${f} nicht unterstützt`,
  sideTitle: 'Unterstützte Formate', sideIn: 'Ein: JPEG · PNG · WebP · AVIF · GIF (erstes Bild) · HEIC/HEIF · BMP', sideOut: 'Aus: JPEG · PNG · WebP · AVIF',
  guideTitle: 'Welches Format?', guideJpeg: 'JPEG: Fotos, an alle senden', guidePng: 'PNG: Screenshots, Icons, verlustfrei', guideWebp: 'WebP: Web, klein, Transparenz', guideAvif: 'AVIF: am kleinsten, langsamer',
  sumOut: 'Ausgabe', sumQuality: (q) => `Qualität ${q}`, sumExif: 'EXIF behalten', sumChange: 'Ändern',
  detailOrig: 'Original', detailOut: 'Umgewandelt', detailSize: 'Größe', detailExif: 'EXIF', detailNote: 'Hinweis', origLabel: (f) => `Original ${f}`,
  exifNone: 'Original ohne EXIF', exifOff: 'Nicht behalten', exifKept: 'Behalten (GPS entfernt)', exifAvif: 'AVIF trägt kein EXIF',
  changeTo: (f) => `Als ${f}`, share: (ext) => `Teilen / sichern .${ext}`, qualityN: (q) => `Qualität ${q}`, lossless: 'verlustfrei',
}

const fr: Messages = {
  title: 'Convertir le format', sub: 'Converti en local · Jamais envoyé', docTitle: 'Convertisseur de format d’image - HEIC / WebP / AVIF / PNG / JPEG, en local', metaDesc: 'Convertisseur d’images gratuit : HEIC en JPG, WebP en JPG, PNG en WebP, etc. Tout se fait dans votre navigateur ; aucun fichier n’est envoyé.',
  dropTitle: 'Déposez, collez ou choisissez des images', dropTitleTouch: 'Choisir des images', dropSub: 'Lots et dossiers entiers · Traité uniquement dans votre navigateur, jamais envoyé', dropSubTouch: 'Traité sur cet appareil, jamais envoyé', dropAria: 'Choisir des images', addMore: '+ Ajouter des images', dropAnywhere: 'Relâchez pour ajouter', pickFolder: 'Choisir un dossier',
  notImage: (n) => `${n} fichiers non image ignorés`, dupSkipped: (n) => `${n} doublons ignorés`, pasteEmpty: 'Aucune image dans le presse-papiers',
  listTitle: 'Conversions', count: (n) => `${n} image${Number(n) > 1 ? 's' : ''}`, clear: 'Vider', clearConfirm: 'Tout vider ?', reconvert: 'Reconvertir', downloadAll: 'Tout télécharger .zip', saveAll: 'Tout enregistrer / télécharger', zipping: 'Compression…', start: 'Convertir', startN: (n) => `Convertir (${n})`,
  stripDone: 'Terminées', stripRunning: 'En cours', stripFailed: 'Échecs', stripUnsupported: 'Non prises en charge', stripTotal: (a, b) => `Total ${a} → ${b}`,
  stQueued: 'En attente', stConverting: 'Conversion', stDone: 'Terminé', stFailed: 'Échec', stUnsupported: 'Non pris en charge', stCancelled: 'Annulé', stStale: 'Réglages modifiés',
  download: (ext) => `Télécharger .${ext}`, cancel: 'Annuler', remove: 'Supprimer', retry: 'Réessayer', close: 'Fermer', openDetails: 'Détails',
  settingsTitle: 'Réglages de conversion', outFormat: 'Format de sortie', fmtAuto: 'Auto', fmtHintAuto: 'Choisi par fichier : HEIC et photos en JPEG, PNG transparents en WebP.', fmtHintJpeg: 'S’ouvre partout, idéal pour les photos ; sans transparence.', fmtHintPng: 'Sans perte, pour captures et icônes ; fichiers plus lourds.', fmtHintWebp: 'Pour le web : léger, garde la transparence.', fmtHintAvif: 'Le plus léger, encodage lent ; certaines anciennes applis ne l’ouvrent pas.',
  quality: 'Qualité', smaller: 'Plus léger', sharper: 'Plus net', pngLossless: 'Le PNG est sans perte : pas de qualité à régler.', qualityAuto: (j, w) => `En auto : JPEG ${j} · WebP ${w}`,
  fill: 'Zones transparentes', fillHint: 'Utilisé seulement quand une image transparente devient JPEG.', fillWhite: 'Blanc', fillBlack: 'Noir', fillGray: 'Gris clair', fillHexAria: 'Couleur de fond (hex)',
  keepExif: 'Garder l’EXIF (infos de prise de vue)', keepExifHint: 'Appareil et date conservés ; la position GPS est toujours retirée.', keepName: 'Garder les noms', keepNameHint: 'Désactivé : les noms prennent le suffixe -converted.',
  noteFilled: (hex) => `Transparence remplie en ${hex}`, noteFirstFrame: 'Animée · première image seulement', noteExifKept: 'EXIF gardé · GPS retiré', noteExifAvif: 'L’AVIF ne garde pas l’EXIF', noteSameFormat: (q) => `Même format, réencodé en qualité ${q}`, noteAvifSlow: 'L’AVIF est lent à encoder, patientez', noteP3: 'Couleurs Display P3 conservées',
  errDecode: 'Décodage impossible : fichier peut-être endommagé', errAvifDecode: 'Décodage impossible : fichier endommagé, ou ce navigateur ne décode pas l’AVIF', errHeic: 'Échec du décodage HEIC, vous pouvez réessayer', errTooLarge: 'Trop de pixels (plus de 80 mégapixels) ; réduisez d’abord l’image', errEncode: 'Échec de l’encodage : ce navigateur ne sait pas écrire ce format', errFailed: 'La conversion a échoué, réessayez',
  unsupportedHint: (f) => `Le ${f} n’est pas encore pris en charge en entrée ; ignoré.`, unsupportedShort: (f) => `${f} non pris en charge`,
  sideTitle: 'Formats pris en charge', sideIn: 'Entrée : JPEG · PNG · WebP · AVIF · GIF (1re image) · HEIC/HEIF · BMP', sideOut: 'Sortie : JPEG · PNG · WebP · AVIF',
  guideTitle: 'Quel format choisir ?', guideJpeg: 'JPEG : photos, envoyer à tout le monde', guidePng: 'PNG : captures, icônes, sans perte', guideWebp: 'WebP : web, léger, transparence', guideAvif: 'AVIF : le plus léger, plus lent',
  sumOut: 'Sortie', sumQuality: (q) => `qualité ${q}`, sumExif: 'EXIF gardé', sumChange: 'Modifier',
  detailOrig: 'Original', detailOut: 'Converti', detailSize: 'Taille', detailExif: 'EXIF', detailNote: 'Remarque', origLabel: (f) => `Original ${f}`,
  exifNone: 'Pas d’EXIF dans l’original', exifOff: 'Non conservé', exifKept: 'Conservé (GPS retiré)', exifAvif: 'L’AVIF ne porte pas d’EXIF',
  changeTo: (f) => `Passer en ${f}`, share: (ext) => `Partager / enregistrer .${ext}`, qualityN: (q) => `qualité ${q}`, lossless: 'sans perte',
}

export const CONVERT_MESSAGES: Record<Lang, Messages> = { zh, en, ja, ko, de, fr }

export function convertT(lang: Lang, key: string, ...args: (string | number)[]): string {
  const v = CONVERT_MESSAGES[lang]?.[key] ?? en[key]
  if (v === undefined) return key
  return typeof v === 'function' ? v(...args) : v
}
