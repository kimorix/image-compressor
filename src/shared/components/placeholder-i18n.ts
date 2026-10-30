// Copy for the tool placeholder page only (a lazy chunk), kept out of the
// shared dictionary so it never weighs on the first load. Same six
// languages; English is the fallback for a missing key.
import type { Lang } from '../i18n'

const MESSAGES: Record<Lang, Record<string, string>> = {
  zh: {
    descImgToPdf: '多张图片按顺序合成一个 PDF，或每张一个',
    descPdfMerge: '合并多个 PDF，整理、旋转、拆分页面',
    soonSub: '本地处理 · 文件不上传',
    soonNote: '这个工具正在开发中，很快就能用。所有处理都会在浏览器本地完成。',
    soonTryCompress: '先去压缩图片',
    soonTryPdf: '先用 PDF 转 Word',
  },
  en: {
    descImgToPdf: 'Turn images into one PDF in order, or one PDF each',
    descPdfMerge: 'Merge PDFs, reorder, rotate and split pages',
    soonSub: 'Processed locally · Never uploaded',
    soonNote: 'This tool is being built and will be here soon. Everything will run locally in your browser.',
    soonTryCompress: 'Compress images meanwhile',
    soonTryPdf: 'Try PDF to Word meanwhile',
  },
  ja: {
    descImgToPdf: '複数の画像を順番に 1 つの PDF に、または 1 枚ずつ',
    descPdfMerge: 'PDF の結合、ページの並べ替え・回転・分割',
    soonSub: 'ローカル処理 · アップロードなし',
    soonNote: 'このツールは開発中で、まもなく使えるようになります。処理はすべてブラウザ内で行われます。',
    soonTryCompress: '画像を圧縮する',
    soonTryPdf: 'PDF を Word に変換する',
  },
  ko: {
    descImgToPdf: '여러 이미지를 순서대로 하나의 PDF로, 또는 한 장씩',
    descPdfMerge: 'PDF 병합, 페이지 정렬·회전·분할',
    soonSub: '로컬 처리 · 업로드 없음',
    soonNote: '이 도구는 개발 중이며 곧 제공됩니다. 모든 처리는 브라우저에서 로컬로 이루어집니다.',
    soonTryCompress: '이미지 압축하기',
    soonTryPdf: 'PDF를 Word로 변환하기',
  },
  fr: {
    descImgToPdf: 'Des images en un seul PDF dans l’ordre, ou un PDF chacune',
    descPdfMerge: 'Fusionner des PDF, réordonner, pivoter et diviser les pages',
    soonSub: 'Traitement local · Jamais envoyé',
    soonNote: 'Cet outil est en cours de création et arrive bientôt. Tout se fera localement dans votre navigateur.',
    soonTryCompress: 'Compresser des images en attendant',
    soonTryPdf: 'Essayer PDF vers Word en attendant',
  },
  de: {
    descImgToPdf: 'Bilder der Reihe nach zu einem PDF oder je einem PDF',
    descPdfMerge: 'PDFs zusammenfügen, Seiten sortieren, drehen und teilen',
    soonSub: 'Lokal verarbeitet · Nie hochgeladen',
    soonNote: 'Dieses Werkzeug entsteht gerade und ist bald verfügbar. Alles läuft lokal in Ihrem Browser.',
    soonTryCompress: 'Inzwischen Bilder komprimieren',
    soonTryPdf: 'Inzwischen PDF zu Word testen',
  },
}

export function placeholderT(lang: Lang, key: string): string {
  return MESSAGES[lang]?.[key] ?? MESSAGES.en[key] ?? key
}
