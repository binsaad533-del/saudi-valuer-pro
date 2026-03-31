export default function OfficialStamp() {
  return (
    <svg width="140" height="140" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <path id="topArc" d="M 100,100 m -70,0 a 70,70 0 1,1 140,0" />
        <path id="bottomArc" d="M 100,100 m 70,0 a 70,70 0 1,1 -140,0" />
      </defs>

      {/* Outer double border */}
      <circle cx="100" cy="100" r="95" fill="none" stroke="#1e3a5f" strokeWidth="3" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="#1e3a5f" strokeWidth="1.5" />

      {/* Inner circle */}
      <circle cx="100" cy="100" r="50" fill="none" stroke="#1e3a5f" strokeWidth="1.5" />

      {/* Top circular text */}
      <text fill="#1e3a5f" fontSize="14" fontWeight="bold" fontFamily="Cairo, sans-serif">
        <textPath href="#topArc" startOffset="50%" textAnchor="middle">
          شركة جساس للتقييم
        </textPath>
      </text>

      {/* Bottom circular text */}
      <text fill="#1e3a5f" fontSize="13" fontFamily="Cairo, sans-serif">
        <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
          1010625839
        </textPath>
      </text>

      {/* Center text */}
      <text x="100" y="93" textAnchor="middle" fill="#1e3a5f" fontSize="20" fontWeight="bold" fontFamily="Cairo, sans-serif">
        جساس
      </text>
      <text x="100" y="115" textAnchor="middle" fill="#1e3a5f" fontSize="12" fontFamily="Cairo, sans-serif">
        معتمد
      </text>
    </svg>
  );
}
