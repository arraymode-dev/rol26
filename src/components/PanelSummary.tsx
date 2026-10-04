import type { ReactNode, Ref } from "react";
import { ChevronUp } from "lucide-react";

export function PanelSummary({
  badge,
  title,
  subtitle,
  label,
  className = "",
  buttonRef,
  onExpand,
}: {
  badge: ReactNode;
  title: string;
  subtitle?: string;
  label: string;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  onExpand: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      className={`panel-summary ${className}`}
      aria-label={label}
      aria-expanded={false}
      onClick={onExpand}
    >
      <span className="panel-summary-badge">{badge}</span>
      <span className="panel-summary-copy">
        <span>{title}</span>
        {subtitle && <small>{subtitle}</small>}
      </span>
      <ChevronUp size={20} />
    </button>
  );
}
