# Flexible competition access schedules

## What will change
- Add an **Access schedule** choice when creating or editing a competition:
  - **Lifetime access** — enrolled students can start on any date while the competition is active.
  - **Date range** — students can start at any time on the selected date or between the selected start and end dates.
  - **Exact date & time** — students can start only inside the selected date-and-time window.
- Keep the test duration required in every mode, so each attempt still ends after its configured duration.
- Show clear schedule labels to admins and students instead of empty or misleading dates.
- Keep every existing competition on its current exact date-and-time schedule.

## Access enforcement
- Update the database start and answer protections to understand all three modes, preventing direct-link bypasses.
- Apply the same schedule rules to first attempts, retakes, countdowns, enrollment messaging, and the student competition list.
- Lifetime and date-range competitions remain governed by the existing Active switch, enrollment, attempt limits, and submission lock.

## Technical details
- Add a constrained `schedule_type` field to competitions and make date/time fields nullable.
- Return open-ended boundaries from the trusted competition-window function where appropriate.
- Update frontend types and schedule helpers so access decisions are consistent everywhere.
- Verify an existing timed competition plus newly created lifetime and date-range competitions.
