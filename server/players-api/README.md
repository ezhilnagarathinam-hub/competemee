Minimal Players API for polling from the student UI

Setup:

1. Create `.env` with `DATABASE_URL` pointing to your Lovable Cloud Postgres DB.
2. From `server/players-api` run:

```bash
npm init -y
npm install express cors pg dotenv
node index.js
```

Endpoint:
GET /players?competition_id=... -> returns JSON array of players: `{ student_id, name, total_marks, current_question }`

Notes:

- Use `VITE_PLAYERS_API_URL` in the frontend to point to this server for local development.
- Keep DB credentials secret; use environment variables.
