export function PageHero({ children, art }: { children: React.ReactNode; art: React.ReactNode }) {
  return (
    <section className="hero-banner glass-edge relative overflow-hidden">
      {art}
      <div className="hero-wash absolute inset-0" />
      <div className="relative z-10 flex h-full flex-col justify-start gap-3 p-4 pt-6 sm:gap-4 sm:p-6 sm:pt-8 lg:justify-center lg:p-8 lg:pt-10">
        {children}
      </div>
    </section>
  );
}
