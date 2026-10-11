export function ProductArt({ art }: { art: string }) {
  return (
    <div className="flex h-24 items-center justify-center" aria-hidden>
      {art === "wheat" || art === "wheat-green" ? (
        <Wheat green={art === "wheat-green"} />
      ) : art === "sugar" ? (
        <Sugar />
      ) : art === "dal" ? (
        <Dal />
      ) : art === "bran" ? (
        <Bran />
      ) : art === "salt" ? (
        <Sack tone="#f4f1ea" band="#d9d3c6" />
      ) : (
        <Sack tone="#e7c89a" band="#c4a06a" />
      )}
    </div>
  );
}

function Sack({ tone, band }: { tone: string; band: string }) {
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-28">
      <ellipse cx="60" cy="78" rx="28" ry="6" fill="#e4eee6" />
      <path
        d="M38 28c0-8 8-14 22-14s22 6 22 14c8 4 14 14 14 26 0 16-12 28-36 28S24 70 24 54c0-12 6-22 14-26z"
        fill={tone}
      />
      <path d="M44 24c4-8 28-8 32 0" fill="none" stroke={band} strokeWidth="4" strokeLinecap="round" />
      <rect x="46" y="40" width="28" height="16" rx="3" fill={band} opacity="0.85" />
      <path d="M52 48h16" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Bran() {
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-28">
      <ellipse cx="60" cy="78" rx="28" ry="6" fill="#e4eee6" />
      <path
        d="M40 30c2-10 38-10 40 0 8 6 12 16 12 26 0 14-12 24-32 24S28 70 28 56c0-10 4-20 12-26z"
        fill="#d7b07a"
      />
      <circle cx="48" cy="50" r="3" fill="#f3e2c4" />
      <circle cx="62" cy="46" r="2.5" fill="#f3e2c4" />
      <circle cx="70" cy="56" r="3" fill="#f3e2c4" />
      <circle cx="54" cy="60" r="2" fill="#f3e2c4" />
    </svg>
  );
}

function Wheat({ green }: { green: boolean }) {
  const stalk = green ? "#6a8f4e" : "#c4a15a";
  const grain = green ? "#7ea85a" : "#e2c27a";
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-28">
      <ellipse cx="60" cy="80" rx="26" ry="5" fill="#e4eee6" />
      {[42, 60, 78].map((x, i) => (
        <g key={x} transform={`translate(${x} 18)`}>
          <path d={`M8 ${70 - i * 4} V10`} stroke={stalk} strokeWidth="2" fill="none" />
          {[0, 8, 16, 24, 32].map((y) => (
            <g key={y}>
              <ellipse cx="3" cy={y + 12} rx="4" ry="2.4" fill={grain} transform={`rotate(-30 3 ${y + 12})`} />
              <ellipse cx="13" cy={y + 12} rx="4" ry="2.4" fill={grain} transform={`rotate(30 13 ${y + 12})`} />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

function Sugar() {
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-28">
      <ellipse cx="60" cy="76" rx="26" ry="5" fill="#e4eee6" />
      <rect x="28" y="40" width="26" height="22" rx="3" fill="#f7f3ea" stroke="#e4dccb" />
      <rect x="48" y="32" width="26" height="22" rx="3" fill="#fffaf3" stroke="#e4dccb" />
      <rect x="64" y="46" width="26" height="22" rx="3" fill="#f3eee4" stroke="#e4dccb" />
    </svg>
  );
}

function Dal() {
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-28">
      <ellipse cx="60" cy="74" rx="30" ry="8" fill="#e7d3b0" />
      {[
        [36, 58],
        [50, 52],
        [64, 58],
        [78, 50],
        [44, 66],
        [60, 68],
        [74, 64],
        [54, 60],
      ].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="7" ry="4" fill="#c9843a" transform={`rotate(-20 ${x} ${y})`} />
      ))}
    </svg>
  );
}
