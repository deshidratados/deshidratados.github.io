export default function SunLogo({ size = 28, className = '', style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="24" y1="8" x2="24" y2="14" />
        <line x1="24" y1="34" x2="24" y2="40" />
        <line x1="8" y1="24" x2="14" y2="24" />
        <line x1="34" y1="24" x2="40" y2="24" />
        <line x1="13" y1="13" x2="17" y2="17" />
        <line x1="31" y1="31" x2="35" y2="35" />
        <line x1="35" y1="13" x2="31" y2="17" />
        <line x1="17" y1="31" x2="13" y2="35" />
      </g>
      <circle cx="24" cy="24" r="5" fill="currentColor" />
    </svg>
  );
}
