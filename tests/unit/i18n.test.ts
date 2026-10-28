import { describe, expect, it } from 'vitest'
import { LANGS, MESSAGES } from '../../src/shared/i18n'
import { placeholderT } from '../../src/shared/components/placeholder-i18n'

// Importing the dictionary runs its module-level guard, which throws when any
// language is missing a key. This test additionally pins the result-table
// header keys, so a new column cannot ship in only one language.
describe('i18n dictionaries', () => {
  const tableHeader = ['thImage', 'thFormat', 'thOrig', 'thComp', 'thSave', 'thDims', 'thStatus', 'thActions']

  it('defines the results table header in every language', () => {
    for (const messages of Object.values(MESSAGES)) {
      for (const key of tableHeader) {
        expect(messages[key]).toBeTypeOf('string')
      }
    }
  })

  it('defines the mobile masonry, detail sheet and More menu copy in every language', () => {
    const mobile = [
      'statusQueued', 'detailTitle', 'detailNotes', 'openDetails',
      'moreImageConvert', 'moreImageConvertDesc', 'navPdf', 'tabCompress', 'tabPdf',
      'comingSoon', 'saveToAlbum', 'deleteBtn',
    ]
    for (const messages of Object.values(MESSAGES)) {
      for (const key of mobile) {
        expect(messages[key]).toBeTypeOf('string')
      }
    }
  })

  it('defines the shared navigation copy (tool groups, PDF hub, placeholders) in every language', () => {
    const nav = [
      'navGroupImage', 'navGroupPdf', 'navTool', 'navConvert', 'navResize', 'navPdf', 'navImgToPdf', 'navPdfMerge', 'navHistory',
      'hubTitle', 'hubToWord', 'hubImgToPdf', 'hubMerge', 'moreImageConvertDesc', 'moreResizeDesc',
    ]
    for (const messages of Object.values(MESSAGES)) {
      for (const key of nav) {
        expect(messages[key]).toBeTypeOf('string')
        expect((messages[key] as string).length).toBeGreaterThan(0)
      }
    }
  })

  it('defines the tool placeholder copy in every language (no English fallback needed)', () => {
    for (const key of ['descImgToPdf', 'descPdfMerge', 'soonSub', 'soonNote', 'soonTryCompress', 'soonTryPdf']) {
      const en = placeholderT('en', key)
      expect(en).not.toBe(key)
      for (const { code } of LANGS) {
        const v = placeholderT(code, key)
        expect(v.length).toBeGreaterThan(0)
        if (code !== 'en') expect(v).not.toBe(en)
      }
    }
  })
})
