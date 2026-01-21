# UX QA Flow (Wizard)

## Step structure
- Present one question per screen.
- Each step contains:
  - Question prompt.
  - Allowed answer input control(s) for the question type.
  - Required/optional indicator.
  - Navigation actions (Next, Back, Skip where permitted).

## Allowed answer types
- **Single select**: choose exactly one option.
- **Multi select**: choose one or more options.
- **Numeric**: enter a number.
- **Free text**: enter open-ended text.

## Validation rules
- Required questions must be answered before proceeding to the next step.
- Optional questions may be skipped without providing an answer.
- Equipment access is required; the flow must block progress until a selection is made.
- Single select requires exactly one option when required.
- Multi select requires at least one option when required.
- Numeric answers must be a valid number when provided; required numeric questions must have a valid number.
- Free text answers may be any text when provided; required free text must be non-empty.

## Back/skip behavior
- **Back** returns to the previous question and preserves any prior answer.
- **Skip** is available only for optional questions and advances to the next question without saving an answer.
- Changing an answer on a previous step updates the stored response.

## End-of-flow summary and confirmation
- After the final question, present a summary screen listing each question with its recorded answer.
- Clearly label unanswered optional questions as “Skipped” or “No response.”
- Provide a confirmation action to submit the final responses.
- Provide an option to return to any question from the summary to edit before confirmation.
