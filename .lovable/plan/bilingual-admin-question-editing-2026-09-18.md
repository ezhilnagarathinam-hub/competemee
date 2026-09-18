# Bilingual Admin Question Editing

## Goal
Allow admins to edit both the English and Tamil/Hindi versions of a bilingual question from the existing Edit Question window.

## Changes
- Add a clear language switch at the top of the question editor when a translated version exists.
- Keep shared settings such as image, correct answer, and marks consistent across both languages.
- Show translated question text, all four translated options, and translated explanation when Tamil/Hindi is selected.
- Save both language versions together without affecting question numbering, competition assignment, or student test behavior.
- Preserve the translated fields when duplicating a bilingual question.

## Validation
- Open an imported English–Tamil question and confirm both language views load their current content.
- Edit Tamil content, save, reopen, and confirm the updates remain.
- Confirm English-only questions continue using the existing editor normally.
