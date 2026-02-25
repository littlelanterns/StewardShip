import { MessageSquarePlus, PenLine } from 'lucide-react';

interface CustomTemplateCreatorProps {
  onCreateWithAI: () => void;
  onWriteMyself: () => void;
}

export function CustomTemplateCreator({
  onCreateWithAI,
  onWriteMyself,
}: CustomTemplateCreatorProps) {
  return (
    <div className="template-creator">
      <h3 className="template-creator__title">Create Custom Meeting</h3>

      <div
        className="template-creator__option"
        onClick={onCreateWithAI}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onCreateWithAI(); }}
      >
        <div className="template-creator__option-icon">
          <MessageSquarePlus size={24} strokeWidth={1.5} />
        </div>
        <div className="template-creator__option-text">
          <p className="template-creator__option-title">Create with AI</p>
          <p className="template-creator__option-desc">
            Describe your meeting and the AI will build a structured template for you.
          </p>
        </div>
      </div>

      <div
        className="template-creator__option"
        onClick={onWriteMyself}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onWriteMyself(); }}
      >
        <div className="template-creator__option-icon">
          <PenLine size={24} strokeWidth={1.5} />
        </div>
        <div className="template-creator__option-text">
          <p className="template-creator__option-title">Write It Myself</p>
          <p className="template-creator__option-desc">
            Define your own agenda sections and AI prompts.
          </p>
        </div>
      </div>
    </div>
  );
}
