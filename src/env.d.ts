/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// wasm-pack bundler glue ships without typings.
declare module 'imagequant/imagequant_bg.js'
