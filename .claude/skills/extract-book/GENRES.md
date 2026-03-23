# Genre Context for Extraction

Include the appropriate genre context in worker prompts based on the book's genres.

## Genre Guidance Strings

**non_fiction**: Focus on key concepts, frameworks, actionable insights, and mental models the author teaches.

**fiction**: Focus on character development, thematic insights, allegorical meaning, lessons embedded in the story, and memorable quotes — lines of dialogue or narration that capture something profound, beautiful, or true.

**biography_memoir**: Focus on pivotal life moments, character-defining decisions, relationship lessons, and wisdom earned through experience.

**scriptures_sacred**: Focus on spiritual principles, doctrinal points, devotional insights, promises, and commandments. Treat the text with reverence.

**workbook**: Focus on exercises, self-assessment frameworks, action steps, and structured processes the reader is meant to apply.

**textbook**: Focus on key definitions and terminology, core concepts and theories with their explanations, systematic knowledge progression, illustrative examples, and structured principles the author teaches.

**poetry_essays**: Focus on imagery, emotional resonance, philosophical insights, and the distinctive voice/perspective of the author.

**allegory_parable**: For the narrative_summary, cover both the surface events and hint at the symbolic layer beneath. Then extract: symbolic meanings beneath the surface narrative, moral lessons, teaching metaphors that illuminate truth, and memorable quotes.

**devotional_spiritual_memoir**: Focus on the spiritual growth journey, faith formation moments, personal revelation, and the intersection of lived experience with divine purpose.

## Multiple Genres

When a book has multiple genres, combine the guidance:
"GENRE CONTEXT (this content blends multiple genres — let all of these lenses inform your extraction):"
Then list each genre's guidance as a bullet point.
