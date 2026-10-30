// Metro resuelve las fuentes como asset (número en nativo, URL en web).
declare module '*.woff2' {
  const source: number | string
  export default source
}
