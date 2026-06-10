/**
 * 官方 KHQR 字标（白字，透明底）— 几何造型与 Bakong KHQR 标识一致。
 */
export default function KhqrWordmark({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 128 43"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="KHQR"
      {...props}
    >
      <g fill="#fff">
        {/* K — 左竖 + 两斜笔，与竖笔留缝 */}
        <rect x="4" y="5" width="4.6" height="33" rx="0.6" />
        <path d="M14.2 5 L18.4 5 L35.2 21.5 L31 21.5 Z" />
        <path d="M14.2 38 L18.4 38 L35.2 21.5 L31 21.5 Z" />

        {/* H */}
        <rect x="38.2" y="5" width="4.6" height="33" rx="0.6" />
        <rect x="38.2" y="19.2" width="16.2" height="4.6" rx="0.6" />
        <rect x="49.8" y="5" width="4.6" height="33" rx="0.6" />

        {/* Q — 圆角方框 + 居中镂空 + 右下尾 */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M59.8 8 H82.2 A3.8 3.8 0 0 1 86 11.8 V31.2 A3.8 3.8 0 0 1 82.2 35 H59.8 A3.8 3.8 0 0 1 56 31.2 V11.8 A3.8 3.8 0 0 1 59.8 8 Z
             M64.2 12.4 H77.8 V30.6 H64.2 Z"
        />
        <path d="M81.6 30.2 L92.6 36.8 L89 41 L78 34.4 Z" />

        {/* R — 竖笔 + 上弧（左侧开口）+ 斜脚 */}
        <rect x="96.4" y="5" width="4.6" height="33" rx="0.6" />
        <path d="M108.4 24.6 L124.2 38 L119.4 38 L105.2 26.2 Z" />
      </g>
      <path
        d="M101 5 H113.4 C121.2 5 125.6 9.4 125.6 15.2 C125.6 21 121.2 25.4 113.4 25.4"
        stroke="#fff"
        strokeWidth="4.6"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  )
}
