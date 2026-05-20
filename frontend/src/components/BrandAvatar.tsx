// Styled brand avatar for @actualizateconia
// Used in social media preview cards

interface BrandAvatarProps {
  size?: number;
  ring?: boolean; // Instagram gradient ring
}

export function BrandAvatar({ size = 36, ring = false }: BrandAvatarProps) {
  const inner = (
    <div
      style={{ width: size, height: size }}
      className="relative shrink-0"
    >
      {/* Try to load the actual logo */}
      <img
        src="/logo.png"
        alt="Actualizate con IA"
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
        onError={(e) => {
          // Fallback: styled hexagon
          (e.currentTarget as HTMLImageElement).style.display = "none";
          const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement;
          if (fb) fb.style.display = "flex";
        }}
      />
      {/* Fallback hexagon avatar */}
      <div
        style={{
          width: size,
          height: size,
          display: "none",
          clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
          background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #c9a84c 100%)",
          position: "absolute",
          top: 0,
          left: 0,
        }}
        className="items-center justify-center text-white font-bold"
      >
        <span style={{ fontSize: size * 0.4, lineHeight: 1 }}>A</span>
      </div>
    </div>
  );

  if (!ring) return inner;

  return (
    <div
      style={{ width: size + 4, height: size + 4 }}
      className="rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px] shrink-0"
    >
      <div className="h-full w-full rounded-full bg-[#111] overflow-hidden flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Actualizate con IA"
          style={{ width: size, height: size }}
          className="rounded-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement;
            if (fb) fb.style.display = "flex";
          }}
        />
        <div
          style={{
            width: size,
            height: size,
            display: "none",
            background: "linear-gradient(135deg, #0ea5e9, #c9a84c)",
          }}
          className="rounded-full items-center justify-center text-white font-bold text-xs"
        >
          A
        </div>
      </div>
    </div>
  );
}
