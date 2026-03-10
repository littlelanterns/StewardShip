import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import './CollapsibleGroup.css';

interface CollapsibleGroupProps {
  label: string;
  count: number;
  children: ReactNode;
  defaultExpanded?: boolean;
  headerAction?: ReactNode;
}

export function CollapsibleGroup({
  label,
  count,
  children,
  defaultExpanded = true,
  headerAction,
}: CollapsibleGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible-group">
      <div className="collapsible-group__header-row">
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
        {headerAction && (
          <div className="collapsible-group__action" onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>
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
