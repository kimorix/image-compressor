// piexifjs ships no TypeScript types; its API surface used here is small
// (load / dump / insert on binary strings), so `any` is the honest typing.
declare module 'piexifjs' {
  const piexif: any
  export default piexif
}
