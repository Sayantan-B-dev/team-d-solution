export default function HeroArtwork() {
  return (
    <div className="hero-r" aria-hidden="true">
      <svg
        className="art art-back"
        viewBox="0 0 400 560"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <circle cx="360" cy="150" r="70" fill="var(--pale)" />
        <circle cx="320" cy="110" r="46" fill="var(--pale)" />
        <path d="M-10 330C60 300 110 380 110 450C110 520 60 560 -10 570Z" fill="var(--accent)" />
        <g stroke="var(--ink)" strokeWidth="1.2" fill="none">
          <path d="M120 60L250 20L320 130L190 180Z" />
          <path d="M0 150C100 150 200 110 240 20" />
        </g>
        <g fill="var(--pale)">
          <circle cx="330" cy="470" r="14" />
          <circle cx="355" cy="455" r="14" />
          <circle cx="372" cy="480" r="14" />
          <circle cx="338" cy="498" r="14" />
          <circle cx="310" cy="500" r="14" />
          <circle cx="360" cy="515" r="14" />
        </g>
      </svg>

      <svg
        className="art art-front"
        viewBox="0 0 400 560"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <g fill="var(--ink)">
          <rect x="95" y="38" width="48" height="48" rx="12" />
          <rect x="226" y="0" width="48" height="48" rx="12" />
          <rect x="296" y="108" width="48" height="48" rx="12" />
          <rect x="166" y="156" width="48" height="48" rx="12" />
        </g>
        <polygon points="150,92 235,92 192,160" fill="var(--accent)" />
        <g transform="rotate(-8 220 290)">
          <rect x="90" y="235" width="280" height="110" rx="55" fill="var(--blue)" />
          <circle cx="300" cy="290" r="38" fill="var(--bg)" />
        </g>
        <g fill="var(--ink)">
          <polygon points="150,365 260,345 225,520 205,430 100,470" />
        </g>
      </svg>
    </div>
  );
}
