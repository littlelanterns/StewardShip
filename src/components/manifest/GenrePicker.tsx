import type { BookGenre } from '../../lib/types';
import { BOOK_GENRE_LABELS } from '../../lib/types';

const ALL_GENRES: BookGenre[] = [
  'non_fiction',
  'fiction',
  'biography_memoir',
  'scriptures_sacred',
  'workbook',
  'poetry_essays',
  'allegory_parable',
  'devotional_spiritual_memoir',
];

interface GenrePickerProps {
  selected: BookGenre[];
  onChange: (genres: BookGenre[]) => void;
  disabled?: boolean;
}

export function GenrePicker({ selected, onChange, disabled }: GenrePickerProps) {
  const toggle = (genre: BookGenre) => {
    if (disabled) return;
    const next = selected.includes(genre)
      ? selected.filter((g) => g !== genre)
      : [...selected, genre];
    onChange(next);
  };

  return (
    <div className="genre-picker">
      <p className="genre-picker__label">What kind of book is this? <span className="genre-picker__hint">(select all that apply)</span></p>
      <div className="genre-picker__chips">
        {ALL_GENRES.map((genre) => (
          <button
            key={genre}
            type="button"
            className={`genre-picker__chip${selected.includes(genre) ? ' genre-picker__chip--active' : ''}`}
            onClick={() => toggle(genre)}
            disabled={disabled}
          >
            {BOOK_GENRE_LABELS[genre]}
          </button>
        ))}
      </div>
    </div>
  );
}
