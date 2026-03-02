import logoWalk from "@/assets/logo-walk-holding-transparent.png";

interface WalkLogoProps {
  width?: number;
  className?: string;
}

const WalkLogo = ({ width = 280, className = "" }: WalkLogoProps) => {
  return (
    <img
      src={logoWalk}
      alt="Walk Holding Corporation"
      style={{ width: `${width}px`, height: "auto" }}
      className={className}
    />
  );
};

export default WalkLogo;
