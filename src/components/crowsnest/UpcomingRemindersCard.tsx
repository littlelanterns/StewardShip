import { Bell, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../shared/Card';
import type { Reminder } from '../../lib/types';
import { REMINDER_TYPE_LABELS } from '../../lib/types';
import './CrowsNestCards.css';

interface UpcomingRemindersCardProps {
  reminders: Reminder[];
}

export function UpcomingRemindersCard({ reminders }: UpcomingRemindersCardProps) {
  const navigate = useNavigate();

  if (reminders.length === 0) return null;

  return (
    <Card className="cn-card" onClick={() => navigate('/reveille')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">
          <Bell size={16} /> Upcoming
        </h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      <div className="cn-reminders">
        {reminders.map((r) => (
          <div key={r.id} className="cn-reminder">
            <span className="cn-reminder__title">{r.title}</span>
            <span className="cn-reminder__type">{REMINDER_TYPE_LABELS[r.reminder_type]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
