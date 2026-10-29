/**
 * alphaTab's files, embedded by the build (scripts/build.ts): the UMD script as text, the Bravura
 * font as a data URL, the sonivox soundfont as base64.
 */
declare module 'virtual:alphatab-script' {
    const script: string
    export default script
}

declare module 'virtual:alphatab-font' {
    const dataUrl: string
    export default dataUrl
}

declare module 'virtual:alphatab-soundfont' {
    const base64: string
    export default base64
}
