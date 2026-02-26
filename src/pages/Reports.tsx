import { useState } from 'react';
import { FeatureGuide, LoadingSpinner } from '../components/shared';
import { Button } from '../components/shared/Button';
import { Card } from '../components/shared/Card';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { usePageContext } from '../hooks/usePageContext';
import { useReportGenerator } from '../hooks/useReportGenerator';
import { useAuthContext } from '../contexts/AuthContext';
import { generateReportPDF, generateReportMarkdown } from '../lib/reportExport';
import type { ReportPeriod, ReportSection, ReportConfig } from '../lib/types';
import {
  REPORT_PERIOD_LABELS,
  REPORT_SECTION_LABELS,
  COMPASS_LIFE_AREA_LABELS,
  LOG_ENTRY_TYPE_LABELS,
} from '../lib/types';
import type { CompassLifeArea } from '../lib/types';
import './Reports.css';

const ALL_PERIODS: ReportPeriod[] = ['today', 'this_week', 'this_month', 'last_month', 'custom'];
const ALL_SECTIONS: ReportSection[] = ['tasks', 'routines', 'journal', 'victories', 'reflections', 'goals', 'streaks'];

export default function Reports() {
  usePageContext({ page: 'reports' });
  const { profile } = useAuthContext();
  const { reportData, loading, error, generateReport } = useReportGenerator();

  const [period, setPeriod] = useState<ReportPeriod>('this_week');
  const [sections, setSections] = useState<Set<ReportSection>>(new Set(ALL_SECTIONS));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const toggleSection = (s: ReportSection) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleGenerate = () => {
    const config: ReportConfig = {
      period,
      sections: Array.from(sections),
      dateFrom: period === 'custom' ? dateFrom : undefined,
      dateTo: period === 'custom' ? dateTo : undefined,
    };
    generateReport(config);
  };

  const handleExportPDF = () => {
    if (!reportData) return;
    const blob = generateReportPDF(reportData, profile?.display_name || 'Steward');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stewardship-report-${reportData.dateFrom}-to-${reportData.dateTo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!reportData) return;
    const md = generateReportMarkdown(reportData, profile?.display_name || 'Steward');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stewardship-report-${reportData.dateFrom}-to-${reportData.dateTo}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page reports-page">
      <div className="reports-page__header">
        <h1 className="reports-page__title">Reports</h1>
        <p className="reports-page__subtitle">Generate progress reports across your voyage.</p>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.reports} />

      {/* Period Selector */}
      <div className="reports-page__section">
        <label className="reports-page__label">Time Period</label>
        <div className="reports-page__option-row">
          {ALL_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`reports-page__option ${period === p ? 'reports-page__option--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {REPORT_PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="reports-page__date-row">
            <input
              type="date"
              className="reports-page__date-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="reports-page__date-sep">to</span>
            <input
              type="date"
              className="reports-page__date-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Section Selector */}
      <div className="reports-page__section">
        <label className="reports-page__label">Include Sections</label>
        <div className="reports-page__option-row reports-page__option-row--wrap">
          {ALL_SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`reports-page__option ${sections.has(s) ? 'reports-page__option--active' : ''}`}
              onClick={() => toggleSection(s)}
            >
              {REPORT_SECTION_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={loading || sections.size === 0}>
        {loading ? 'Generating...' : 'Generate Preview'}
      </Button>

      {error && <p className="reports-page__error">{error}</p>}

      {loading && (
        <div className="reports-page__loading"><LoadingSpinner /></div>
      )}

      {/* Preview */}
      {reportData && !loading && (
        <div className="reports-page__preview">
          <div className="reports-page__preview-header">
            <h2 className="reports-page__preview-title">
              Report: {REPORT_PERIOD_LABELS[reportData.period]}
            </h2>
            <span className="reports-page__preview-range">
              {reportData.dateFrom} to {reportData.dateTo}
            </span>
          </div>

          {/* Tasks */}
          {reportData.tasks && (
            <Card className="reports-page__card">
              <h3 className="reports-page__card-title">Tasks</h3>
              <div className="reports-page__stat-grid">
                <div className="reports-page__stat">
                  <span className="reports-page__stat-value">{reportData.tasks.completed}</span>
                  <span className="reports-page__stat-label">Completed</span>
                </div>
                <div className="reports-page__stat">
                  <span className="reports-page__stat-value">{reportData.tasks.pending}</span>
                  <span className="reports-page__stat-label">Pending</span>
                </div>
                {reportData.tasks.carried_forward > 0 && (
                  <div className="reports-page__stat">
                    <span className="reports-page__stat-value">{reportData.tasks.carried_forward}</span>
                    <span className="reports-page__stat-label">Carried Forward</span>
                  </div>
                )}
              </div>
              {Object.entries(reportData.tasks.byLifeArea).length > 0 && (
                <div className="reports-page__breakdown">
                  <span className="reports-page__breakdown-label">By Life Area:</span>
                  {Object.entries(reportData.tasks.byLifeArea)
                    .sort(([, a], [, b]) => b - a)
                    .map(([area, count]) => (
                      <span key={area} className="reports-page__breakdown-item">
                        {COMPASS_LIFE_AREA_LABELS[area as CompassLifeArea] || area.replace(/_/g, ' ')}: {count}
                      </span>
                    ))}
                </div>
              )}
            </Card>
          )}

          {/* Routines */}
          {reportData.routines && reportData.routines.length > 0 && (
            <Card className="reports-page__card">
              <h3 className="reports-page__card-title">Routines</h3>
              {reportData.routines.map((r, i) => (
                <div key={i} className="reports-page__routine-row">
                  <span className="reports-page__routine-name">{r.routineName}</span>
                  <span className="reports-page__routine-stats">
                    {r.completionCount}x completed, {r.averageCompletion}% avg
                  </span>
                </div>
              ))}
            </Card>
          )}

          {/* Journal */}
          {reportData.journal && (
            <Card className="reports-page__card">
              <h3 className="reports-page__card-title">Journal</h3>
              <p className="reports-page__card-text">
                {reportData.journal.total} {reportData.journal.total === 1 ? 'entry' : 'entries'}
              </p>
              {Object.entries(reportData.journal.byType).length > 0 && (
                <div className="reports-page__breakdown">
                  {Object.entries(reportData.journal.byType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <span key={type} className="reports-page__breakdown-item">
                        {LOG_ENTRY_TYPE_LABELS[type as keyof typeof LOG_ENTRY_TYPE_LABELS] || type}: {count}
                      </span>
                    ))}
                </div>
              )}
            </Card>
          )}

          {/* Victories */}
          {reportData.victories && (
            <Card className="reports-page__card">
              <h3 className="reports-page__card-title">Victories</h3>
              <p className="reports-page__card-text">{reportData.victories.total} recorded</p>
              {reportData.victories.descriptions.length > 0 && (
                <ul className="reports-page__list">
                  {reportData.victories.descriptions.slice(0, 10).map((d, i) => (
                    <li key={i} className="reports-page__list-item">{d}</li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Reflections */}
          {reportData.reflections && (
            <Card className="reports-page__card">
              <h3 className="reports-page__card-title">Reflections</h3>
              <p className="reports-page__card-text">{reportData.reflections.total} responses</p>
              {reportData.reflections.questions.length > 0 && (
                <div className="reports-page__reflections-list">
                  {reportData.reflections.questions.slice(0, 10).map((q, i) => (
                    <div key={i} className="reports-page__reflection-item">
                      <span className="reports-page__reflection-q">{q.question}</span>
                      <p className="reports-page__reflection-a">{q.response}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Goals */}
          {reportData.goals && reportData.goals.length > 0 && (
            <Card className="reports-page__card">
              <h3 className="reports-page__card-title">Goals</h3>
              {reportData.goals.map((g, i) => (
                <div key={i} className="reports-page__routine-row">
                  <span className="reports-page__routine-name">{g.title}</span>
                  <span className="reports-page__routine-stats">
                    {g.progress}{g.target ? `/${g.target}` : ''} ({g.status})
                  </span>
                </div>
              ))}
            </Card>
          )}

          {/* Streaks */}
          {reportData.streaks && reportData.streaks.length > 0 && (
            <Card className="reports-page__card">
              <h3 className="reports-page__card-title">Streaks</h3>
              {reportData.streaks.map((s, i) => (
                <div key={i} className="reports-page__routine-row">
                  <span className="reports-page__routine-name">{s.taskTitle}</span>
                  <span className="reports-page__routine-stats">
                    Current: {s.currentStreak} | Best: {s.longestStreak}
                  </span>
                </div>
              ))}
            </Card>
          )}

          {/* Export buttons */}
          <div className="reports-page__export-row">
            <Button onClick={handleExportPDF}>Download PDF</Button>
            <Button variant="secondary" onClick={handleExportMarkdown}>Download Markdown</Button>
          </div>
        </div>
      )}
    </div>
  );
}
