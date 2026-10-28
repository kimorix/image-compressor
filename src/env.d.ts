/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// wasm-pack bundler glue ships without typings.
declare module 'imagequant/imagequant_bg.js'

// tesseract.js ships its ESM browser build without a typings entry; the
// loader casts it to the package's own types.
declare module 'tesseract.js/dist/tesseract.esm.min.js'
