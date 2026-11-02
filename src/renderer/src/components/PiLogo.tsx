/**
 * Pi 品牌标志。单独成文件，替换品牌时只改这一个文件。
 * 原始 viewBox 0 0 800 800，三色：珊瑚 / 蓝 / 黄。
 */
export function PiLogo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 800 800"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#F09082" d="M165.29 165.29H517.36V400H400V282.65H165.29Z" />
      <path fill="#4D9ABF" d="M165.29 282.65H282.65V400H400V517.36H282.65V634.72H165.29Z" />
      <path fill="#F1BE58" d="M517.36 400H634.72V634.72H517.36Z" />
    </svg>
  )
}

/** 起始页水印：同一标志斜切的细描边版 */
export function PiWatermark({ size = 390 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.683}
      viewBox="-130 165 687 469"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="#e5e5e7" strokeWidth="4.5" transform="skewX(-25)">
        <path d="M165.29 165.29H517.36V400H400V282.65H165.29Z" />
        <path d="M165.29 282.65H282.65V400H400V517.36H282.65V634.72H165.29Z" />
        <path d="M517.36 400H634.72V634.72H517.36Z" />
      </g>
    </svg>
  )
}
