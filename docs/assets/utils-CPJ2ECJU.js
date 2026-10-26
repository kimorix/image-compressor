function c(i,n,r={}){let t;return n&&(t=(s,a)=>{const e=new WebAssembly.Instance(n,s);return a(e),e.exports}),i({noInitialRun:!0,instantiateWasm:t,...r})}export{c as initEmscriptenModule};
