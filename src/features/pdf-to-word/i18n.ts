// PDF to Word strings, kept inside the feature: the shared dictionary
// throws when a key is missing in any language, and this chunk only loads
// with the PDF page. Same six languages as the app; English is the
// fallback for a missing key.
import type { Lang } from '../../shared/i18n'

type Fn = (...args: (string | number)[]) => string
type Messages = Record<string, string | Fn>

const zh: Messages = {
  title: 'PDF 转 Word', sub: '本地转换 · 文件不上传', docTitle: 'PDF 转 Word - 本地转换，文件不上传', metaDesc: '免费的 PDF 转 Word 工具，所有转换都在浏览器本地完成，文件不会上传到任何服务器。',
  dropTitle: '拖入或选择 PDF', dropTitleTouch: '选择 PDF', dropSub: '支持多个文件 · 文件只在你的浏览器里处理，不会上传', dropSubTouch: '文件只在本机处理，不会上传', dropAria: '选择 PDF 文件', addMore: '+ 添加 PDF', dropAnywhere: '松开添加 PDF', notPdf: (n) => `已跳过 ${n} 个非 PDF 文件`, dupSkipped: (n) => `已跳过 ${n} 个重复文件`,
  listTitle: '转换列表', clear: '清空', clearConfirm: '确认清空？', start: '开始转换', downloadAll: '全部下载', saveAll: '全部存储 / 下载', zipping: '正在打包…',
  pagesSize: (n, s) => `${n} 页 · ${s}`, pagesOnly: (n) => `${n} 页`, kindText: '文字型', kindScanned: '扫描件 · 需 OCR', kindScannedOcr: '扫描件 · OCR',
  stProbing: '读取中…', stReady: '待转换', stQueued: '排队中', stConverting: (p, n) => `转换中 第 ${p}/${n} 页`, stOcr: (p, n) => `识别文字 第 ${p}/${n} 页`, stBuilding: '生成 Word…', stDone: '已完成', stFailed: '转换失败', stCancelled: '已取消', locked: '已加密',
  downloadDocx: '下载 .docx', cancel: '取消', remove: '删除', retry: '重试', enableOcr: '开启 OCR', openDetails: '查看详情', close: '关闭',
  scannedHint: '没有可选中文字。开启右侧 OCR 后可识别成文字，或用“保留版式”。', scannedHintMobile: '没有可选中文字。在设置里开启 OCR 后可识别成文字。',
  needPassword: '需要密码', passwordPh: '输入密码', unlock: '解锁', badPassword: '密码不对，请重试', passwordAria: (n) => `${n} 的密码`,
  settingsTitle: '转换设置', modeLabel: '转换模式', modeEditable: '可编辑', modeLayout: '保留版式', modeEditableDesc: '重排成可编辑的段落，最适合修改内容。', modeLayoutDesc: '每页按原位置摆放文字和图片，看起来和 PDF 一样，文字仍可编辑。',
  rangeLabel: '页码范围', rangePh: '全部（如 1-3,5）', rangeBad: '页码格式不对，例：1-3,5', rangeOut: '页码超出了文件页数', keepImages: '保留图片', ocrLabel: '扫描件 OCR', ocrLang: '识别语言', ocrSize: (mb) => `首次使用约下载 ${mb} MB（识别引擎 + 所选语言），之后离线可用。`,
  'lang_chi_sim+eng': '简体中文 + 英文', 'lang_chi_tra+eng': '繁体中文 + 英文', lang_eng: '英文', 'lang_jpn+eng': '日文 + 英文', 'lang_kor+eng': '韩文 + 英文', 'lang_deu+eng': '德文 + 英文', 'lang_fra+eng': '法文 + 英文',
  sideTitle: '说明', sideDesc: '文字型 PDF 可还原标题、段落、列表、图片和简单表格。扫描件需开启 OCR。',
  capTitle: '还原能力', cap1: '标题 / 段落 / 列表 / 粗斜体', cap2: '图片、双栏、简单表格', cap3: '复杂表格、公式、文本框',
  detailOrig: '原文件', detailWord: 'Word', detailFound: '识别', detailNote: '提示', found: (h, i, t) => `${h} 个标题 · ${i} 张图片 · ${t} 个表格`, pageSwipe: (p, n) => `第 ${p} / ${n} 页 · 左右滑动`, share: '分享 / 存储 .docx', reconvert: '重新转换', tagEditable: '可编辑模式', tagLayout: '保留版式模式',
  warnScannedAsImage: '扫描页没有识别文字，已按图片放入', warnOcrEmpty: '部分页没识别出文字，已按图片放入', warnPartial: '只转换了所选页码', twoCol: (n) => `${n} 页双栏已按阅读顺序排列`, ocrPages: (n) => `${n} 页通过 OCR 识别`,
  errOpen: '无法打开这个 PDF，文件可能已损坏', errFailed: '转换失败，请重试', errRange: '页码范围不对，请检查设置',
  errOcr: 'OCR 组件加载失败：首次使用需要联网下载语言包',
  emptyList: '还没有 PDF，先从上面添加文件',
}

const en: Messages = {
  title: 'PDF to Word', sub: 'Converted locally · Never uploaded', docTitle: 'PDF to Word - converted locally, never uploaded', metaDesc: 'Free PDF to Word converter. Everything runs in your browser; files are never uploaded to a server.',
  dropTitle: 'Drop or choose PDFs', dropTitleTouch: 'Choose PDFs', dropSub: 'Multiple files · Processed only in your browser, never uploaded', dropSubTouch: 'Processed on this device, never uploaded', dropAria: 'Choose PDF files', addMore: '+ Add PDFs', dropAnywhere: 'Drop to add PDFs', notPdf: (n) => `Skipped ${n} non-PDF files`, dupSkipped: (n) => `Skipped ${n} duplicate files`,
  listTitle: 'Conversions', clear: 'Clear', clearConfirm: 'Clear all?', start: 'Convert', downloadAll: 'Download all', saveAll: 'Save / download all', zipping: 'Zipping…',
  pagesSize: (n, s) => `${n} pages · ${s}`, pagesOnly: (n) => `${n} pages`, kindText: 'Text', kindScanned: 'Scanned · needs OCR', kindScannedOcr: 'Scanned · OCR',
  stProbing: 'Reading…', stReady: 'Ready', stQueued: 'Queued', stConverting: (p, n) => `Converting page ${p}/${n}`, stOcr: (p, n) => `Recognising page ${p}/${n}`, stBuilding: 'Building Word file…', stDone: 'Done', stFailed: 'Failed', stCancelled: 'Cancelled', locked: 'Encrypted',
  downloadDocx: 'Download .docx', cancel: 'Cancel', remove: 'Remove', retry: 'Retry', enableOcr: 'Turn on OCR', openDetails: 'Details', close: 'Close',
  scannedHint: 'No selectable text. Turn on OCR on the right to recognise it, or use “Keep layout”.', scannedHintMobile: 'No selectable text. Turn on OCR in Settings to recognise it.',
  needPassword: 'Password required', passwordPh: 'Enter password', unlock: 'Unlock', badPassword: 'Wrong password, try again', passwordAria: (n) => `Password for ${n}`,
  settingsTitle: 'Conversion settings', modeLabel: 'Mode', modeEditable: 'Editable', modeLayout: 'Keep layout', modeEditableDesc: 'Reflows into editable paragraphs. Best for changing the content.', modeLayoutDesc: 'Places text and pictures where they are on each page, so it looks like the PDF; the text stays editable.',
  rangeLabel: 'Pages', rangePh: 'All (e.g. 1-3,5)', rangeBad: 'Invalid pages, e.g. 1-3,5', rangeOut: 'Pages beyond the end of the file', keepImages: 'Keep images', ocrLabel: 'OCR for scans', ocrLang: 'OCR language', ocrSize: (mb) => `First use downloads about ${mb} MB (engine + selected languages); it works offline afterwards.`,
  'lang_chi_sim+eng': 'Simplified Chinese + English', 'lang_chi_tra+eng': 'Traditional Chinese + English', lang_eng: 'English', 'lang_jpn+eng': 'Japanese + English', 'lang_kor+eng': 'Korean + English', 'lang_deu+eng': 'German + English', 'lang_fra+eng': 'French + English',
  sideTitle: 'About', sideDesc: 'Text PDFs keep their headings, paragraphs, lists, images and simple tables. Scans need OCR.',
  capTitle: 'What is kept', cap1: 'Headings / paragraphs / lists / bold & italic', cap2: 'Images, two columns, simple tables', cap3: 'Complex tables, formulas, text boxes',
  detailOrig: 'Original', detailWord: 'Word', detailFound: 'Found', detailNote: 'Note', found: (h, i, t) => `${h} headings · ${i} images · ${t} tables`, pageSwipe: (p, n) => `Page ${p} / ${n} · swipe`, share: 'Share / save .docx', reconvert: 'Convert again', tagEditable: 'Editable', tagLayout: 'Keep layout',
  warnScannedAsImage: 'Scanned pages were not recognised and are kept as pictures', warnOcrEmpty: 'Some pages had no recognisable text and are kept as pictures', warnPartial: 'Only the selected pages were converted', twoCol: (n) => `${n} two-column pages put in reading order`, ocrPages: (n) => `${n} pages recognised with OCR`,
  errOpen: 'Cannot open this PDF; the file may be damaged', errFailed: 'Conversion failed, please retry', errRange: 'Invalid page range, check the settings',
  errOcr: 'OCR could not load: the first use needs a connection to download the language pack',
  emptyList: 'No PDFs yet. Add files above.',
}

const ja: Messages = {
  title: 'PDF を Word に', sub: 'ローカル変換 · アップロードなし', docTitle: 'PDF を Word に変換 - ローカル処理、アップロードなし', metaDesc: '無料の PDF→Word 変換ツール。すべてブラウザ内で処理され、ファイルはサーバーにアップロードされません。',
  dropTitle: 'PDF をドロップまたは選択', dropTitleTouch: 'PDF を選択', dropSub: '複数ファイル対応 · ブラウザ内だけで処理し、アップロードしません', dropSubTouch: 'この端末だけで処理し、アップロードしません', dropAria: 'PDF ファイルを選択', addMore: '+ PDF を追加', dropAnywhere: '離して PDF を追加', notPdf: (n) => `PDF 以外のファイル ${n} 件をスキップしました`, dupSkipped: (n) => `重複ファイル ${n} 件をスキップしました`,
  listTitle: '変換リスト', clear: 'クリア', clearConfirm: 'すべて消去？', start: '変換開始', downloadAll: 'すべてダウンロード', saveAll: 'すべて保存 / ダウンロード', zipping: '圧縮中…',
  pagesSize: (n, s) => `${n} ページ · ${s}`, pagesOnly: (n) => `${n} ページ`, kindText: 'テキスト', kindScanned: 'スキャン · OCR が必要', kindScannedOcr: 'スキャン · OCR',
  stProbing: '読み込み中…', stReady: '変換待ち', stQueued: '待機中', stConverting: (p, n) => `変換中 ${p}/${n} ページ`, stOcr: (p, n) => `文字認識中 ${p}/${n} ページ`, stBuilding: 'Word を生成中…', stDone: '完了', stFailed: '失敗', stCancelled: 'キャンセル済み', locked: '暗号化',
  downloadDocx: '.docx をダウンロード', cancel: 'キャンセル', remove: '削除', retry: '再試行', enableOcr: 'OCR をオン', openDetails: '詳細', close: '閉じる',
  scannedHint: '選択できる文字がありません。右側で OCR をオンにすると文字を認識できます。または「レイアウト保持」を使ってください。', scannedHintMobile: '選択できる文字がありません。設定で OCR をオンにすると認識できます。',
  needPassword: 'パスワードが必要', passwordPh: 'パスワードを入力', unlock: '解除', badPassword: 'パスワードが違います', passwordAria: (n) => `${n} のパスワード`,
  settingsTitle: '変換設定', modeLabel: '変換モード', modeEditable: '編集可能', modeLayout: 'レイアウト保持', modeEditableDesc: '編集しやすい段落に組み直します。内容の修正に最適です。', modeLayoutDesc: '各ページの文字と画像を元の位置に配置し、PDF と同じ見た目にします。文字は編集できます。',
  rangeLabel: 'ページ範囲', rangePh: 'すべて（例 1-3,5）', rangeBad: 'ページ指定が正しくありません（例 1-3,5）', rangeOut: 'ファイルのページ数を超えています', keepImages: '画像を保持', ocrLabel: 'スキャン OCR', ocrLang: '認識言語', ocrSize: (mb) => `初回は約 ${mb} MB（認識エンジン + 選択した言語）をダウンロードし、その後はオフラインで使えます。`,
  'lang_chi_sim+eng': '簡体字中国語 + 英語', 'lang_chi_tra+eng': '繁体字中国語 + 英語', lang_eng: '英語', 'lang_jpn+eng': '日本語 + 英語', 'lang_kor+eng': '韓国語 + 英語', 'lang_deu+eng': 'ドイツ語 + 英語', 'lang_fra+eng': 'フランス語 + 英語',
  sideTitle: '説明', sideDesc: 'テキスト PDF は見出し、段落、リスト、画像、簡単な表を再現します。スキャンは OCR が必要です。',
  capTitle: '再現できるもの', cap1: '見出し / 段落 / リスト / 太字・斜体', cap2: '画像、2 段組み、簡単な表', cap3: '複雑な表、数式、テキストボックス',
  detailOrig: '元ファイル', detailWord: 'Word', detailFound: '認識', detailNote: 'ヒント', found: (h, i, t) => `見出し ${h} · 画像 ${i} · 表 ${t}`, pageSwipe: (p, n) => `${p} / ${n} ページ · 左右にスワイプ`, share: '.docx を共有 / 保存', reconvert: '再変換', tagEditable: '編集可能', tagLayout: 'レイアウト保持',
  warnScannedAsImage: 'スキャンページは文字認識されず、画像として入れました', warnOcrEmpty: '一部のページは文字を認識できず、画像として入れました', warnPartial: '選択したページだけを変換しました', twoCol: (n) => `2 段組み ${n} ページを読み順に並べました`, ocrPages: (n) => `${n} ページを OCR で認識`,
  errOpen: 'この PDF を開けません。ファイルが壊れている可能性があります', errFailed: '変換に失敗しました。再試行してください', errRange: 'ページ範囲が正しくありません。設定を確認してください',
  errOcr: 'OCR を読み込めません。初回は言語データのダウンロードにネット接続が必要です',
  emptyList: 'まだ PDF がありません。上から追加してください',
}

const ko: Messages = {
  title: 'PDF를 Word로', sub: '로컬 변환 · 업로드 없음', docTitle: 'PDF를 Word로 - 로컬 변환, 업로드 없음', metaDesc: '무료 PDF→Word 변환 도구. 모든 변환은 브라우저에서 처리되며 파일은 서버에 업로드되지 않습니다.',
  dropTitle: 'PDF를 끌어 놓거나 선택', dropTitleTouch: 'PDF 선택', dropSub: '여러 파일 지원 · 브라우저에서만 처리되며 업로드되지 않습니다', dropSubTouch: '이 기기에서만 처리되며 업로드되지 않습니다', dropAria: 'PDF 파일 선택', addMore: '+ PDF 추가', dropAnywhere: '놓아서 PDF 추가', notPdf: (n) => `PDF가 아닌 파일 ${n}개를 건너뛰었습니다`, dupSkipped: (n) => `중복 파일 ${n}개를 건너뛰었습니다`,
  listTitle: '변환 목록', clear: '비우기', clearConfirm: '모두 비울까요?', start: '변환 시작', downloadAll: '모두 다운로드', saveAll: '모두 저장 / 다운로드', zipping: '압축 중…',
  pagesSize: (n, s) => `${n}쪽 · ${s}`, pagesOnly: (n) => `${n}쪽`, kindText: '텍스트', kindScanned: '스캔본 · OCR 필요', kindScannedOcr: '스캔본 · OCR',
  stProbing: '읽는 중…', stReady: '변환 대기', stQueued: '대기 중', stConverting: (p, n) => `변환 중 ${p}/${n}쪽`, stOcr: (p, n) => `문자 인식 중 ${p}/${n}쪽`, stBuilding: 'Word 생성 중…', stDone: '완료', stFailed: '실패', stCancelled: '취소됨', locked: '암호화됨',
  downloadDocx: '.docx 다운로드', cancel: '취소', remove: '삭제', retry: '다시 시도', enableOcr: 'OCR 켜기', openDetails: '상세', close: '닫기',
  scannedHint: '선택 가능한 텍스트가 없습니다. 오른쪽에서 OCR을 켜면 인식할 수 있고, ‘레이아웃 유지’도 사용할 수 있습니다.', scannedHintMobile: '선택 가능한 텍스트가 없습니다. 설정에서 OCR을 켜면 인식할 수 있습니다.',
  needPassword: '비밀번호 필요', passwordPh: '비밀번호 입력', unlock: '잠금 해제', badPassword: '비밀번호가 틀렸습니다', passwordAria: (n) => `${n} 비밀번호`,
  settingsTitle: '변환 설정', modeLabel: '변환 모드', modeEditable: '편집 가능', modeLayout: '레이아웃 유지', modeEditableDesc: '편집하기 쉬운 문단으로 다시 배치합니다. 내용 수정에 가장 좋습니다.', modeLayoutDesc: '각 쪽의 글자와 그림을 원래 위치에 배치해 PDF와 같아 보이며, 글자는 편집할 수 있습니다.',
  rangeLabel: '쪽 범위', rangePh: '전체 (예: 1-3,5)', rangeBad: '쪽 형식이 올바르지 않습니다 (예: 1-3,5)', rangeOut: '파일의 쪽 수를 넘었습니다', keepImages: '이미지 유지', ocrLabel: '스캔본 OCR', ocrLang: '인식 언어', ocrSize: (mb) => `처음 사용할 때 약 ${mb}MB(인식 엔진 + 선택한 언어)를 내려받고, 이후에는 오프라인으로 사용할 수 있습니다.`,
  'lang_chi_sim+eng': '중국어 간체 + 영어', 'lang_chi_tra+eng': '중국어 번체 + 영어', lang_eng: '영어', 'lang_jpn+eng': '일본어 + 영어', 'lang_kor+eng': '한국어 + 영어', 'lang_deu+eng': '독일어 + 영어', 'lang_fra+eng': '프랑스어 + 영어',
  sideTitle: '안내', sideDesc: '텍스트 PDF는 제목, 문단, 목록, 이미지, 간단한 표를 복원합니다. 스캔본은 OCR을 켜야 합니다.',
  capTitle: '복원 범위', cap1: '제목 / 문단 / 목록 / 굵게·기울임', cap2: '이미지, 2단, 간단한 표', cap3: '복잡한 표, 수식, 텍스트 상자',
  detailOrig: '원본', detailWord: 'Word', detailFound: '인식', detailNote: '안내', found: (h, i, t) => `제목 ${h} · 이미지 ${i} · 표 ${t}`, pageSwipe: (p, n) => `${p} / ${n}쪽 · 좌우로 넘기기`, share: '.docx 공유 / 저장', reconvert: '다시 변환', tagEditable: '편집 가능', tagLayout: '레이아웃 유지',
  warnScannedAsImage: '스캔 쪽은 인식되지 않아 그림으로 넣었습니다', warnOcrEmpty: '일부 쪽은 글자를 인식하지 못해 그림으로 넣었습니다', warnPartial: '선택한 쪽만 변환했습니다', twoCol: (n) => `2단 ${n}쪽을 읽는 순서로 배치했습니다`, ocrPages: (n) => `${n}쪽을 OCR로 인식`,
  errOpen: '이 PDF를 열 수 없습니다. 파일이 손상되었을 수 있습니다', errFailed: '변환에 실패했습니다. 다시 시도해 주세요', errRange: '쪽 범위가 올바르지 않습니다. 설정을 확인해 주세요',
  errOcr: 'OCR을 불러오지 못했습니다. 처음에는 언어 데이터를 내려받을 인터넷 연결이 필요합니다',
  emptyList: '아직 PDF가 없습니다. 위에서 추가하세요',
}

const de: Messages = {
  title: 'PDF zu Word', sub: 'Lokal umgewandelt · Kein Upload', docTitle: 'PDF zu Word - lokal umgewandelt, kein Upload', metaDesc: 'Kostenloser PDF-zu-Word-Konverter. Alles läuft im Browser; Dateien werden nie auf einen Server hochgeladen.',
  dropTitle: 'PDFs ablegen oder wählen', dropTitleTouch: 'PDFs wählen', dropSub: 'Mehrere Dateien · Nur im Browser verarbeitet, nie hochgeladen', dropSubTouch: 'Nur auf diesem Gerät verarbeitet, nie hochgeladen', dropAria: 'PDF-Dateien wählen', addMore: '+ PDFs hinzufügen', dropAnywhere: 'Loslassen, um PDFs hinzuzufügen', notPdf: (n) => `${n} Nicht-PDF-Dateien übersprungen`, dupSkipped: (n) => `${n} doppelte Dateien übersprungen`,
  listTitle: 'Umwandlungen', clear: 'Leeren', clearConfirm: 'Alles leeren?', start: 'Umwandeln', downloadAll: 'Alle herunterladen', saveAll: 'Alle sichern / laden', zipping: 'Wird gepackt…',
  pagesSize: (n, s) => `${n} Seiten · ${s}`, pagesOnly: (n) => `${n} Seiten`, kindText: 'Text', kindScanned: 'Scan · OCR nötig', kindScannedOcr: 'Scan · OCR',
  stProbing: 'Wird gelesen…', stReady: 'Bereit', stQueued: 'Wartet', stConverting: (p, n) => `Seite ${p}/${n} wird umgewandelt`, stOcr: (p, n) => `Texterkennung Seite ${p}/${n}`, stBuilding: 'Word-Datei wird erstellt…', stDone: 'Fertig', stFailed: 'Fehlgeschlagen', stCancelled: 'Abgebrochen', locked: 'Verschlüsselt',
  downloadDocx: '.docx laden', cancel: 'Abbrechen', remove: 'Entfernen', retry: 'Erneut', enableOcr: 'OCR einschalten', openDetails: 'Details', close: 'Schließen',
  scannedHint: 'Kein markierbarer Text. Schalten Sie rechts OCR ein, um ihn zu erkennen, oder nutzen Sie „Layout behalten“.', scannedHintMobile: 'Kein markierbarer Text. Schalten Sie in den Einstellungen OCR ein.',
  needPassword: 'Passwort nötig', passwordPh: 'Passwort eingeben', unlock: 'Entsperren', badPassword: 'Falsches Passwort, bitte erneut', passwordAria: (n) => `Passwort für ${n}`,
  settingsTitle: 'Umwandlung', modeLabel: 'Modus', modeEditable: 'Bearbeitbar', modeLayout: 'Layout behalten', modeEditableDesc: 'Fließtext in bearbeitbaren Absätzen. Am besten, um Inhalte zu ändern.', modeLayoutDesc: 'Text und Bilder stehen an ihrer Stelle auf jeder Seite, wie im PDF; der Text bleibt bearbeitbar.',
  rangeLabel: 'Seiten', rangePh: 'Alle (z. B. 1-3,5)', rangeBad: 'Ungültige Seiten, z. B. 1-3,5', rangeOut: 'Seiten nach dem Dateiende', keepImages: 'Bilder behalten', ocrLabel: 'OCR für Scans', ocrLang: 'OCR-Sprache', ocrSize: (mb) => `Beim ersten Mal werden ca. ${mb} MB geladen (Engine + gewählte Sprachen); danach geht es offline.`,
  'lang_chi_sim+eng': 'Chinesisch (vereinfacht) + Englisch', 'lang_chi_tra+eng': 'Chinesisch (traditionell) + Englisch', lang_eng: 'Englisch', 'lang_jpn+eng': 'Japanisch + Englisch', 'lang_kor+eng': 'Koreanisch + Englisch', 'lang_deu+eng': 'Deutsch + Englisch', 'lang_fra+eng': 'Französisch + Englisch',
  sideTitle: 'Hinweis', sideDesc: 'Text-PDFs behalten Überschriften, Absätze, Listen, Bilder und einfache Tabellen. Scans brauchen OCR.',
  capTitle: 'Was erhalten bleibt', cap1: 'Überschriften / Absätze / Listen / fett & kursiv', cap2: 'Bilder, zwei Spalten, einfache Tabellen', cap3: 'Komplexe Tabellen, Formeln, Textfelder',
  detailOrig: 'Original', detailWord: 'Word', detailFound: 'Erkannt', detailNote: 'Hinweis', found: (h, i, t) => `${h} Überschriften · ${i} Bilder · ${t} Tabellen`, pageSwipe: (p, n) => `Seite ${p} / ${n} · wischen`, share: '.docx teilen / sichern', reconvert: 'Neu umwandeln', tagEditable: 'Bearbeitbar', tagLayout: 'Layout behalten',
  warnScannedAsImage: 'Gescannte Seiten wurden nicht erkannt und als Bild übernommen', warnOcrEmpty: 'Einige Seiten ohne erkennbaren Text wurden als Bild übernommen', warnPartial: 'Nur die gewählten Seiten wurden umgewandelt', twoCol: (n) => `${n} zweispaltige Seiten in Lesereihenfolge`, ocrPages: (n) => `${n} Seiten per OCR erkannt`,
  errOpen: 'Dieses PDF lässt sich nicht öffnen; die Datei ist vielleicht beschädigt', errFailed: 'Umwandlung fehlgeschlagen, bitte erneut versuchen', errRange: 'Ungültiger Seitenbereich, bitte Einstellungen prüfen',
  errOcr: 'OCR konnte nicht laden: Beim ersten Mal wird eine Verbindung für das Sprachpaket gebraucht',
  emptyList: 'Noch keine PDFs. Fügen Sie oben Dateien hinzu.',
}

const fr: Messages = {
  title: 'PDF vers Word', sub: 'Conversion locale · Aucun envoi', docTitle: 'PDF vers Word - conversion locale, aucun envoi', metaDesc: 'Convertisseur PDF vers Word gratuit. Tout se fait dans votre navigateur ; les fichiers ne sont jamais envoyés à un serveur.',
  dropTitle: 'Déposez ou choisissez des PDF', dropTitleTouch: 'Choisir des PDF', dropSub: 'Plusieurs fichiers · Traités dans votre navigateur, jamais envoyés', dropSubTouch: 'Traités sur cet appareil, jamais envoyés', dropAria: 'Choisir des fichiers PDF', addMore: '+ Ajouter des PDF', dropAnywhere: 'Relâchez pour ajouter les PDF', notPdf: (n) => `${n} fichiers non PDF ignorés`, dupSkipped: (n) => `${n} fichiers en double ignorés`,
  listTitle: 'Conversions', clear: 'Vider', clearConfirm: 'Tout vider ?', start: 'Convertir', downloadAll: 'Tout télécharger', saveAll: 'Tout enregistrer', zipping: 'Compression…',
  pagesSize: (n, s) => `${n} pages · ${s}`, pagesOnly: (n) => `${n} pages`, kindText: 'Texte', kindScanned: 'Scan · OCR requis', kindScannedOcr: 'Scan · OCR',
  stProbing: 'Lecture…', stReady: 'Prêt', stQueued: 'En attente', stConverting: (p, n) => `Conversion page ${p}/${n}`, stOcr: (p, n) => `Reconnaissance page ${p}/${n}`, stBuilding: 'Création du Word…', stDone: 'Terminé', stFailed: 'Échec', stCancelled: 'Annulé', locked: 'Chiffré',
  downloadDocx: 'Télécharger .docx', cancel: 'Annuler', remove: 'Supprimer', retry: 'Réessayer', enableOcr: 'Activer l’OCR', openDetails: 'Détails', close: 'Fermer',
  scannedHint: 'Aucun texte sélectionnable. Activez l’OCR à droite pour le reconnaître, ou utilisez « Garder la mise en page ».', scannedHintMobile: 'Aucun texte sélectionnable. Activez l’OCR dans les paramètres.',
  needPassword: 'Mot de passe requis', passwordPh: 'Mot de passe', unlock: 'Déverrouiller', badPassword: 'Mot de passe incorrect, réessayez', passwordAria: (n) => `Mot de passe de ${n}`,
  settingsTitle: 'Paramètres de conversion', modeLabel: 'Mode', modeEditable: 'Modifiable', modeLayout: 'Garder la mise en page', modeEditableDesc: 'Recompose le texte en paragraphes modifiables. Idéal pour changer le contenu.', modeLayoutDesc: 'Place le texte et les images comme sur chaque page du PDF ; le texte reste modifiable.',
  rangeLabel: 'Pages', rangePh: 'Toutes (ex. 1-3,5)', rangeBad: 'Pages invalides, ex. 1-3,5', rangeOut: 'Pages au-delà de la fin du fichier', keepImages: 'Garder les images', ocrLabel: 'OCR des scans', ocrLang: 'Langue OCR', ocrSize: (mb) => `La première fois, environ ${mb} Mo sont téléchargés (moteur + langues choisies) ; ensuite cela marche hors ligne.`,
  'lang_chi_sim+eng': 'Chinois simplifié + anglais', 'lang_chi_tra+eng': 'Chinois traditionnel + anglais', lang_eng: 'Anglais', 'lang_jpn+eng': 'Japonais + anglais', 'lang_kor+eng': 'Coréen + anglais', 'lang_deu+eng': 'Allemand + anglais', 'lang_fra+eng': 'Français + anglais',
  sideTitle: 'À propos', sideDesc: 'Les PDF texte gardent titres, paragraphes, listes, images et tableaux simples. Les scans demandent l’OCR.',
  capTitle: 'Ce qui est conservé', cap1: 'Titres / paragraphes / listes / gras et italique', cap2: 'Images, deux colonnes, tableaux simples', cap3: 'Tableaux complexes, formules, zones de texte',
  detailOrig: 'Original', detailWord: 'Word', detailFound: 'Détecté', detailNote: 'Remarque', found: (h, i, t) => `${h} titres · ${i} images · ${t} tableaux`, pageSwipe: (p, n) => `Page ${p} / ${n} · balayez`, share: 'Partager / enregistrer .docx', reconvert: 'Reconvertir', tagEditable: 'Modifiable', tagLayout: 'Mise en page',
  warnScannedAsImage: 'Les pages scannées n’ont pas été reconnues et sont gardées en image', warnOcrEmpty: 'Certaines pages sans texte reconnu sont gardées en image', warnPartial: 'Seules les pages choisies ont été converties', twoCol: (n) => `${n} pages sur deux colonnes remises dans l’ordre de lecture`, ocrPages: (n) => `${n} pages reconnues par OCR`,
  errOpen: 'Impossible d’ouvrir ce PDF ; le fichier est peut-être endommagé', errFailed: 'La conversion a échoué, réessayez', errRange: 'Plage de pages invalide, vérifiez les paramètres',
  errOcr: 'L’OCR n’a pas pu se charger : la première fois, une connexion est nécessaire pour le pack de langue',
  emptyList: 'Aucun PDF pour l’instant. Ajoutez des fichiers ci-dessus.',
}

export const PDF_MESSAGES: Record<Lang, Messages> = { zh, en, ja, ko, de, fr }

export function pdfT(lang: Lang, key: string, ...args: (string | number)[]): string {
  const v = PDF_MESSAGES[lang]?.[key] ?? en[key]
  if (v === undefined) return key
  return typeof v === 'function' ? v(...args) : v
}
