import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import './CollapsibleGroup.css';

interface CollapsibleGroupProps {
  label: string;
  count: number;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function CollapsibleGroup({
  label,
  count,
  children,
  defaultExpanded = true,
}: CollapsibleGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible-group">
      <button
        className="collapsible-group__header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={`collapsible-group__chevron ${expanded ? 'collapsible-group__chevron--expanded' : ''}`}
        />
        <span className="collapsible-group__label">{label}</span>
        <span className="collapsible-group__count">{count}</span>
      </button>
      <div
        className={`collapsible-group__content ${expanded ? 'collapsible-group__content--expanded' : 'collapsible-group__content--collapsed'}`}
      >
        <div className="collapsible-group__list">
          {children}
        </div>
      </div>
    </div>
  );
}
