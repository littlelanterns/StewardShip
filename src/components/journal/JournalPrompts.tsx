import { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, Search, Shuffle, Plus, Trash2, BookOpen, X } from 'lucide-react';
import { useJournalPrompts } from '../../hooks/useJournalPrompts';
import { Button, LoadingSpinner, EmptyState } from '../shared';
import type { JournalPrompt } from '../../lib/types';
import './JournalPrompts.css';

interface JournalPromptsProps {
  onBack: () => void;
  onUsePrompt: (promptText: string) => void;
}

export default function JournalPrompts({ onBack, onUsePrompt }: JournalPromptsProps) {
  const {
    prompts,
    loading,
    createPrompt,
    updatePromptText,
    archivePrompt,
    getRandomPrompt,
    searchPrompts,
    bookTitles,
  } = useJournalPrompts();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [showRandom, setShowRandom] = useState(false);
  const [randomPrompt, setRandomPrompt] = useState<JournalPrompt | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const books = useMemo(() => bookTitles(), [bookTitles]);

  const visiblePrompts = useMemo(() => {
    let filtered = searchQuery ? searchPrompts(searchQuery) : prompts;
    if (selectedBook) {
      filtered = filtered.filter(p => p.source_book_title === selectedBook);
    }
    return filtered;
  }, [prompts, searchQuery, selectedBook, searchPrompts]);

  const handleRandomPrompt = useCallback(() => {
    const prompt = getRandomPrompt();
    if (prompt) {
      setRandomPrompt(prompt);
      setShowRandom(true);
    }
  }, [getRandomPrompt]);

  const handleUsePrompt = useCallback((promptText: string) => {
    onUsePrompt(promptText);
  }, [onUsePrompt]);

  const handleAddPrompt = useCallback(async () => {
    if (!newPromptText.trim()) return;
    await createPrompt(newPromptText.trim());
    setNewPromptText('');
    setShowAddForm(false);
  }, [newPromptText, createPrompt]);

  const handleArchive = useCallback((id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      archivePrompt(id);
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }, [archivePrompt]);

  const startEdit = (prompt: JournalPrompt) => {
    setEditingId(prompt.id);
    setEditDraft(prompt.prompt_text);
  };

  const saveEdit = () => {
    if (editingId && editDraft.trim()) {
      updatePromptText(editingId, editDraft.trim());
    }
    setEditingId(null);
  };

  if (loading && prompts.length === 0) {
    return (
      <div className="journal-prompts">
        <div className="journal-prompts__header">
          <button type="button" className="journal-prompts__back" onClick={onBack}>
            <ChevronLeft size={20} /> Back
          </button>
          <h2 className="journal-prompts__title">Journal Prompts</h2>
        </div>
        <div className="journal-prompts__loading">
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className="journal-prompts">
      <div className="journal-prompts__header">
        <button type="button" className="journal-prompts__back" onClick={onBack}>
          <ChevronLeft size={20} /> Back
        </button>
        <h2 className="journal-prompts__title">Journal Prompts</h2>
      </div>

      <p className="journal-prompts__subtitle">
        Reflective questions from your reading. Use them to guide your journal entries.
      </p>

      {/* Action bar */}
      <div className="journal-prompts__actions">
        <Button
          size="sm"
          onClick={handleRandomPrompt}
          disabled={prompts.length === 0}
        >
          <Shuffle size={14} /> Random Prompt
        </Button>
        <Button
          size="sm"
          variant="text"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={14} /> Add Custom
        </Button>
      </div>

      {/* Random prompt card */}
      {showRandom && randomPrompt && (
        <div className="journal-prompts__random-card">
          <button
            type="button"
            className="journal-prompts__random-close"
            onClick={() => setShowRandom(false)}
          >
            <X size={16} />
          </button>
          <p className="journal-prompts__random-text">{randomPrompt.prompt_text}</p>
          {randomPrompt.source_book_title && (
            <span className="journal-prompts__random-source">
              <BookOpen size={12} /> {randomPrompt.source_book_title}
            </span>
          )}
          <div className="journal-prompts__random-actions">
            <Button size="sm" onClick={() => handleUsePrompt(randomPrompt.prompt_text)}>
              Write About This
            </Button>
            <Button size="sm" variant="text" onClick={handleRandomPrompt}>
              Another One
            </Button>
          </div>
        </div>
      )}

      {/* Add custom prompt form */}
      {showAddForm && (
        <div className="journal-prompts__add-form">
          <textarea
            className="journal-prompts__add-textarea"
            value={newPromptText}
            onChange={(e) => setNewPromptText(e.target.value)}
            placeholder="Write a reflective question..."
            rows={3}
            autoFocus
          />
          <div className="journal-prompts__add-actions">
            <Button size="sm" onClick={handleAddPrompt} disabled={!newPromptText.trim()}>
              Save Prompt
            </Button>
            <Button size="sm" variant="text" onClick={() => { setShowAddForm(false); setNewPromptText(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="journal-prompts__search-bar">
        <div className="journal-prompts__search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            className="journal-prompts__search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
          />
          {searchQuery && (
            <button type="button" className="journal-prompts__search-clear" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {books.length > 0 && (
          <div className="journal-prompts__book-filter">
            <button
              type="button"
              className={`journal-prompts__book-chip${!selectedBook ? ' journal-prompts__book-chip--active' : ''}`}
              onClick={() => setSelectedBook(null)}
            >
              All
            </button>
            {books.map(book => (
              <button
                key={book}
                type="button"
                className={`journal-prompts__book-chip${selectedBook === book ? ' journal-prompts__book-chip--active' : ''}`}
                onClick={() => setSelectedBook(selectedBook === book ? null : book)}
              >
                {book.length > 30 ? book.substring(0, 28) + '...' : book}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prompt count */}
      <div className="journal-prompts__count">
        {visiblePrompts.length} prompt{visiblePrompts.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
        {selectedBook && ` from "${selectedBook}"`}
      </div>

      {/* Prompt list */}
      {visiblePrompts.length === 0 ? (
        <EmptyState
          heading={prompts.length === 0 ? 'No prompts yet' : 'No matching prompts'}
          message={prompts.length === 0
            ? 'Extract questions from books in The Manifest, or add your own custom prompts.'
            : 'Try adjusting your search or filter.'
          }
        />
      ) : (
        <div className="journal-prompts__list">
          {visiblePrompts.map(prompt => (
            <div
              key={prompt.id}
              className={`journal-prompts__item${deletingIds.has(prompt.id) ? ' journal-prompts__item--deleting' : ''}`}
            >
              {editingId === prompt.id ? (
                <textarea
                  className="journal-prompts__edit-textarea"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                  rows={3}
                />
              ) : (
                <p
                  className="journal-prompts__item-text"
                  onClick={() => startEdit(prompt)}
                  title="Click to edit"
                >
                  {prompt.prompt_text}
                </p>
              )}

              {prompt.source_book_title && (
                <span className="journal-prompts__item-source">
                  <BookOpen size={11} /> {prompt.source_book_title}
                </span>
              )}

              <div className="journal-prompts__item-actions">
                <Button
                  size="sm"
                  onClick={() => handleUsePrompt(prompt.prompt_text)}
                >
                  Write About This
                </Button>
                <button
                  type="button"
                  className="journal-prompts__delete-btn"
                  onClick={() => handleArchive(prompt.id)}
                  title="Remove prompt"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
