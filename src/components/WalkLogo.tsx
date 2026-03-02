interface WalkLogoProps {
  width?: number;
  className?: string;
}

const WalkLogo = ({ width = 280, className = "" }: WalkLogoProps) => {
  const scale = width / 280;
  const height = 80 * scale;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 280 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gold circle outline */}
      <circle cx="40" cy="40" r="30" stroke="#c5943a" strokeWidth="2" fill="none" />

      {/* Stylized cursive W */}
      <path
        d="M22 28
           C22 28, 24 50, 28 54
           C30 57, 32 52, 33 46
           C34 40, 36 34, 37 32
           C38 30, 39 30, 40 34
           C41 38, 42 46, 43 50
           C44 54, 46 56, 48 52
           C50 48, 51 40, 52 36
           C53 32, 54 30, 55 34
           C56 38, 57 48, 58 54"
        stroke="#c5943a"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* WALK text */}
      <text
        x="90"
        y="42"
        fill="#1a365d"
        fontFamily="'DM Sans', 'Inter', sans-serif"
        fontWeight="800"
        fontSize="32"
        letterSpacing="0.18em"
      >
        WALK
      </text>

      {/* HOLDING CORPORATION text */}
      <text
        x="90"
        y="62"
        fill="#1a365d"
        fontFamily="'DM Sans', 'Inter', sans-serif"
        fontWeight="500"
        fontSize="9.5"
        letterSpacing="0.34em"
      >
        HOLDING CORPORATION
      </text>
    </svg>
  );
};

export default WalkLogo;
