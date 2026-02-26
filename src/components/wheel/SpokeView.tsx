import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { WheelInstance, WheelSupportPerson, WheelEvidenceSource, WheelBecomingAction } from '../../lib/types';
import { SPOKE_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './SpokeView.css';

interface SpokeViewProps {
  wheel: WheelInstance;
  spokeNumber: number;
  onEdit?: (spokeNumber: number, field: string, value: string) => void;
}

export function SpokeView({ wheel, spokeNumber }: SpokeViewProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* ignore */ }
  };

  const isComplete = spokeNumber < wheel.current_spoke;
  const isCurrent = spokeNumber === wheel.current_spoke;

  const renderContent = () => {
    switch (spokeNumber) {
      case 0: // Why
        return (
          <div className="spoke-view__section">
            <p className="spoke-view__always">
              The answer is always: to increase self-worth and belonging for myself or others.
            </p>
            {wheel.spoke_1_why && (
              <div className="spoke-view__text-block">
                <p>{wheel.spoke_1_why}</p>
              </div>
            )}
          </div>
        );

      case 1: // When
        return (
          <div className="spoke-view__section">
            <p className="spoke-view__always">The answer is always: as soon as possible.</p>
            {wheel.spoke_2_notes && (
              <div className="spoke-view__text-block">
                <p>{wheel.spoke_2_notes}</p>
              </div>
            )}
            {(wheel.spoke_2_start_date || wheel.spoke_2_checkpoint_date) && (
              <div className="spoke-view__dates">
                {wheel.spoke_2_start_date && (
                  <span className="spoke-view__date-item">Start: {wheel.spoke_2_start_date}</span>
                )}
                {wheel.spoke_2_checkpoint_date && (
                  <span className="spoke-view__date-item">Checkpoint: {wheel.spoke_2_checkpoint_date}</span>
                )}
              </div>
            )}
          </div>
        );

      case 2: // Self-Inventory
        return (
          <div className="spoke-view__section">
            {wheel.spoke_3_who_i_am && (
              <div className="spoke-view__essay">
                <div className="spoke-view__essay-header">
                  <h4>Who I Am (Honest Assessment)</h4>
                  <button
                    type="button"
                    className="spoke-view__copy-btn"
                    onClick={() => copyToClipboard(wheel.spoke_3_who_i_am!, 'who_i_am')}
                  >
                    {copiedField === 'who_i_am' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === 'who_i_am' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="spoke-view__essay-text">
                  {wheel.spoke_3_who_i_am.split('\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            )}

            {wheel.spoke_3_who_i_want_to_be && (
              <div className="spoke-view__essay">
                <div className="spoke-view__essay-header">
                  <h4>Who I Want to Be (Vision)</h4>
                  <button
                    type="button"
                    className="spoke-view__copy-btn"
                    onClick={() => copyToClipboard(wheel.spoke_3_who_i_want_to_be!, 'who_i_want')}
                  >
                    {copiedField === 'who_i_want' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === 'who_i_want' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="spoke-view__essay-text">
                  {wheel.spoke_3_who_i_want_to_be.split('\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 3: { // Support
        const supportPeople: { role: string; person: WheelSupportPerson }[] = [];
        if (wheel.spoke_4_supporter) supportPeople.push({ role: 'Supporter', person: wheel.spoke_4_supporter });
        if (wheel.spoke_4_reminder) supportPeople.push({ role: 'Reminder', person: wheel.spoke_4_reminder });
        if (wheel.spoke_4_observer) supportPeople.push({ role: 'Observer', person: wheel.spoke_4_observer });

        return (
          <div className="spoke-view__section">
            {supportPeople.length > 0 && (
              <div className="spoke-view__roles">
                {supportPeople.map(({ role, person }, i) => (
                  <Card key={i} className="spoke-view__role-card">
                    <div className="spoke-view__role-header">
                      <strong>{person.name}</strong>
                      <span className="spoke-view__role-badge">{role}{person.role_description ? ` — ${person.role_description}` : ''}</span>
                    </div>
                    {person.conversation_script && (
                      <>
                        <p className="spoke-view__script-preview">
                          {person.conversation_script.length > 150
                            ? person.conversation_script.slice(0, 147) + '...'
                            : person.conversation_script}
                        </p>
                        <button
                          type="button"
                          className="spoke-view__copy-btn"
                          onClick={() => copyToClipboard(person.conversation_script!, `script_${i}`)}
                        >
                          {copiedField === `script_${i}` ? <Check size={14} /> : <Copy size={14} />}
                          {copiedField === `script_${i}` ? 'Copied' : 'Copy Script'}
                        </button>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 4: // Evidence
        return (
          <div className="spoke-view__section">
            {wheel.spoke_5_evidence && wheel.spoke_5_evidence.length > 0 && (
              <div className="spoke-view__evidence-list">
                {wheel.spoke_5_evidence.map((source: WheelEvidenceSource, i: number) => (
                  <div key={i} className="spoke-view__evidence-item">
                    <span className="spoke-view__evidence-type">{source.type.replace(/_/g, ' ')}</span>
                    <span className="spoke-view__evidence-desc">{source.description}</span>
                    {source.seen && (
                      <span className="spoke-view__evidence-seen">Observed{source.date_seen ? ` on ${source.date_seen}` : ''}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 5: // Becoming
        return (
          <div className="spoke-view__section">
            {wheel.spoke_6_becoming && wheel.spoke_6_becoming.length > 0 && (
              <div className="spoke-view__actions-list">
                {wheel.spoke_6_becoming.map((action: WheelBecomingAction, i: number) => (
                  <div key={i} className="spoke-view__action-item">
                    <span>{action.text}</span>
                    {action.compass_task_id && (
                      <span className="spoke-view__action-linked">Linked to Compass</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const hasContent = (() => {
    switch (spokeNumber) {
      case 0: return !!wheel.spoke_1_why;
      case 1: return !!wheel.spoke_2_notes || !!wheel.spoke_2_start_date || !!wheel.spoke_2_checkpoint_date;
      case 2: return !!wheel.spoke_3_who_i_am || !!wheel.spoke_3_who_i_want_to_be;
      case 3: return !!wheel.spoke_4_supporter || !!wheel.spoke_4_reminder || !!wheel.spoke_4_observer;
      case 4: return !!(wheel.spoke_5_evidence && wheel.spoke_5_evidence.length > 0);
      case 5: return !!(wheel.spoke_6_becoming && wheel.spoke_6_becoming.length > 0);
      default: return false;
    }
  })();

  return (
    <div className={`spoke-view${isComplete ? ' spoke-view--complete' : ''}${isCurrent ? ' spoke-view--current' : ''}`}>
      <button
        type="button"
        className="spoke-view__header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="spoke-view__header-left">
          <span className={`spoke-view__number${isComplete ? ' spoke-view__number--done' : ''}`}>
            {spokeNumber + 1}
          </span>
          <span className="spoke-view__name">{SPOKE_LABELS[spokeNumber]}</span>
        </div>
        <div className="spoke-view__header-right">
          {!hasContent && !isCurrent && (
            <span className="spoke-view__empty-badge">Not started</span>
          )}
          {isCurrent && !hasContent && (
            <span className="spoke-view__current-badge">Current</span>
          )}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {expanded && (
        <div className="spoke-view__body">
          {hasContent ? (
            renderContent()
          ) : isCurrent ? (
            <p className="spoke-view__empty">Continue building this spoke at The Helm.</p>
          ) : (
            <p className="spoke-view__empty">This spoke hasn't been started yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
