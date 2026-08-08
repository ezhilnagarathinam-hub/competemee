# WhatsApp Notifications via wa.me Links

Staying on free `wa.me` deep links — no AiSensy, no WATI, no Meta verification, no per-message cost. Every message is composed by the app and opens in your WhatsApp with the text pre-filled; you tap send.

Today only one of these exists (credentials on approval, in Signup Requests). This adds the other two and makes all three share one message system.

## What you get

**1. Credentials on approval** (already working — will be moved onto the shared helper so the wording matches the rest)
Sent from Signup Requests after you approve a player.

**2. Test live / reminder**
On the Competitions page, each competition gets a "Notify Players" action. It lists every player allotted to that competition with a WhatsApp button per row, plus the message preview. Text includes competition name, date, start–end time (12-hour format), duration, and the login link.

**3. Result published**
On the Results page, each leaderboard row gets a WhatsApp button. Text includes competition name, the player's score out of max marks, percentage, rank, and the link to view their full answer review.

## How sending works

Because `wa.me` opens one chat at a time, "notify everyone" cannot be one click. Each list gives you:
- A **per-player WhatsApp button** — opens that chat with text ready.
- A **Copy message** button — for pasting into a WhatsApp group, which is the fast way to reach a whole batch.
- A **sent tick** that greys out rows you have already opened this session, so you don't double-message.

If you later want true one-click bulk sending, that is the point where AiSensy becomes worth paying for — the message templates built here would carry over.

## Technical notes

- New `src/lib/whatsapp.ts`: `toWaNumber(phone)` (strips non-digits, prefixes `91` for 10-digit numbers), `waLink(phone, text)`, and three builders — `credentialsMessage`, `testLiveMessage`, `resultMessage`. All use `window.location.origin` for links and `src/lib/timeFormat.ts` for 12-hour times.
- New `src/components/admin/WhatsAppNotifyDialog.tsx`: reusable recipient list (name, phone, per-row send + copy, sent state held in local `Set`). Takes recipients and a message builder as props.
- `src/pages/admin/Competitions.tsx`: add "Notify Players" per competition; recipients from `student_competitions` joined to `students` for that `competition_id`.
- `src/pages/admin/Results.tsx`: add a WhatsApp button per leaderboard row; needs `phone` added to the existing student select in `loadLeaderboard` if it isn't fetched yet.
- `src/pages/admin/Signups.tsx`: replace its local `credentialMessage` / `whatsappLink` with the shared helpers — no behaviour change.
- No database changes, no edge functions, no secrets.

## Security note

Passwords are delivered as plain text over WhatsApp, and are also stored in plain text in the players table. Worth fixing before you scale, but out of scope here — say the word and I'll plan a hashed-password migration with a forced change on first login.
