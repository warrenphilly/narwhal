export function LiquidScene() {
  return (
    <>
      <div className="liquid-scene" aria-hidden="true">
        <span className="liquid-orb liquid-orb-1" />
        <span className="liquid-orb liquid-orb-2" />
        <span className="liquid-orb liquid-orb-3" />
        <span className="liquid-orb liquid-orb-4" />
        <span className="liquid-orb liquid-orb-5" />
        <span className="liquid-caustic" />
        <span className="liquid-grain" />
      </div>
      <svg className="liquid-filter" aria-hidden="true">
        <filter id="liquid-glass" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="4" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
          <feDisplacementMap in="SourceGraphic" in2="blurred" scale="48" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </>
  );
}
