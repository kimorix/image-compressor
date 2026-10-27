import { describe, expect, it } from 'vitest'
import { MESSAGES } from '../../src/i18n'

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
      'moreImageConvert', 'moreImageConvertDesc', 'morePdfToWord', 'morePdfToWordDesc',
      'comingSoon', 'saveToAlbum', 'deleteBtn',
    ]
    for (const messages of Object.values(MESSAGES)) {
      for (const key of mobile) {
        expect(messages[key]).toBeTypeOf('string')
      }
    }
  })
})
