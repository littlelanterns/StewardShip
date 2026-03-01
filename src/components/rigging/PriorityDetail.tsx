import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Link2, Trophy, Archive, ChevronUp } from 'lucide-react';
import type { Priority, PriorityTier } from '../../lib/types';
import { PRIORITY_TIER_LABELS, PRIORITY_TIER_ORDER } from '../../lib/types';
import { Button } from '../shared/Button';
import { SparkleOverlay } from '../shared/SparkleOverlay';
import './PriorityDetail.css';

interface PriorityDetailProps {
  priority: Priority;
  committedNowCount: number;
  committedLaterItems: Priority[];
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<Priority>) => Promise<void>;
  onMoveTier: (id: string, newTier: PriorityTier) => Promise<void>;
  onAchieve: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onPromote: (id: string) => Promise<void>;
}

export function PriorityDetail({
  priority,
  committedNowCount,
  committedLaterItems,
  onBack,
  onUpdate,
  onMoveTier,
  onAchieve,
  onArchive,
  onPromote,
}: PriorityDetailProps) {
  const [title, setTitle] = useState(priority.title);
  const [description, setDescription] = useState(priority.description || '');
  const [showSparkle, setShowSparkle] = useState(false);
  const [showPromotePrompt, setShowPromotePrompt] = useState(false);
  const titleDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const descDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setTitle(priority.title);
    setDescription(priority.description || '');
  }, [priority]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    titleDebounce.current = setTimeout(() => {
      if (value.trim()) onUpdate(priority.id, { title: value.trim() });
    }, 500);
  };

  const handleDescChange = (value: string) => {
    setDescription(value);
    if (descDebounce.current) clearTimeout(descDebounce.current);
    descDebounce.current = setTimeout(() => {
      onUpdate(priority.id, { description: value.trim() || null });
    }, 500);
  };

  const handleTierChange = async (newTier: PriorityTier) => {
    if (newTier === priority.tier) return;
    if (newTier === 'committed_now' && committedNowCount >= 7) return;
    await onMoveTier(priority.id, newTier);
  };

  const handleAchieve = async () => {
    await onAchieve(priority.id);
    setShowSparkle(true);
    if (committedNowCount - 1 < 5 && committedLaterItems.length > 0) {
      setShowPromotePrompt(true);
    }
  };

  const handlePromoteItem = async (id: string) => {
    await onPromote(id);
    setShowPromotePrompt(false);
  };

  const activeTiers = PRIORITY_TIER_ORDER.filter(t => t !== 'achieved');

  return (
    <div className="priority-detail">
      <div className="priority-detail__top-bar">
        <button type="button" className="priority-detail__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="priority-detail__top-title">Priority</span>
      </div>

      <SparkleOverlay show={showSparkle} size="quick" onComplete={() => setShowSparkle(false)} />

      <div className="priority-detail__section">
        <input
          type="text"
          className="priority-detail__title-input"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Priority title"
        />
      </div>

      <div className="priority-detail__section">
        <div className="priority-detail__label">Description</div>
        <textarea
          className="priority-detail__desc-textarea"
          value={description}
          onChange={(e) => handleDescChange(e.target.value)}
          placeholder="Optional description..."
          rows={3}
        />
      </div>

      {priority.tier !== 'achieved' && (
        <div className="priority-detail__section">
          <div className="priority-detail__label">Tier</div>
          <div className="priority-detail__tier-selector">
            {activeTiers.map((tier) => {
              const disabled = tier === 'committed_now' && committedNowCount >= 7 && priority.tier !== 'committed_now';
              return (
                <button
                  key={tier}
                  type="button"
                  className={`priority-detail__tier-btn priority-detail__tier-btn--${tier} ${priority.tier === tier ? 'priority-detail__tier-btn--active' : ''}`}
                  onClick={() => handleTierChange(tier)}
                  disabled={disabled}
                  title={disabled ? 'Maximum 7 committed now items' : undefined}
                >
                  {PRIORITY_TIER_LABELS[tier]}
                </button>
              );
            })}
          </div>
          {priority.tier === 'committed_now' && committedNowCount >= 7 && (
            <div className="priority-detail__tier-warning">
              You have {committedNowCount} committed now items (recommended max: 7)
            </div>
          )}
        </div>
      )}

      {priority.tier === 'achieved' && priority.achieved_at && (
        <div className="priority-detail__section">
          <div className="priority-detail__achieved-badge">
            <Trophy size={16} />
            Achieved on {new Date(priority.achieved_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}

      {(priority.linked_plan_id || priority.linked_goal_id || priority.linked_wheel_id) && (
        <div className="priority-detail__section">
          <div className="priority-detail__label">Linked Items</div>
          <div className="priority-detail__links">
            {priority.linked_plan_id && (
              <div className="priority-detail__link-item">
                <Link2 size={14} /> Linked to a Plan
              </div>
            )}
            {priority.linked_goal_id && (
              <div className="priority-detail__link-item">
                <Link2 size={14} /> Linked to a Goal
              </div>
            )}
            {priority.linked_wheel_id && (
              <div className="priority-detail__link-item">
                <Link2 size={14} /> Linked to a Wheel
              </div>
            )}
          </div>
        </div>
      )}

      <div className="priority-detail__actions">
        {priority.tier !== 'achieved' && (
          <Button variant="primary" onClick={handleAchieve}>
            <Trophy size={14} /> Achieve
          </Button>
        )}
        <Button variant="secondary" onClick={() => onArchive(priority.id)}>
          <Archive size={14} /> Archive
        </Button>
      </div>

      {showPromotePrompt && committedLaterItems.length > 0 && (
        <div className="priority-detail__promote-prompt">
          <p className="priority-detail__promote-text">
            You have room for another commitment. Promote one from Committed Later?
          </p>
          <div className="priority-detail__promote-items">
            {committedLaterItems.slice(0, 5).map((item) => (
              <button
                key={item.id}
                type="button"
                className="priority-detail__promote-item"
                onClick={() => handlePromoteItem(item.id)}
              >
                <ChevronUp size={14} /> {item.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
