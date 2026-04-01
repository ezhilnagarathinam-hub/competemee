const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/players', async (req, res) => {
  const competition_id = req.query.competition_id;
  if (!competition_id) return res.status(400).json({ error: 'competition_id required' });

  try {
    const client = await pool.connect();

    const scRes = await client.query(
      `SELECT student_id, total_marks FROM student_competitions WHERE competition_id=$1 AND has_started=true`,
      [competition_id]
    );

    const studentIds = scRes.rows.map((r) => r.student_id);
    if (studentIds.length === 0) {
      client.release();
      return res.json([]);
    }

    const studsRes = await client.query(
      `SELECT id, name FROM students WHERE id = ANY($1::uuid[])`,
      [studentIds]
    );

    const ansRes = await client.query(
      `SELECT sa.student_id, MAX(q.question_number) AS current_question
       FROM student_answers sa
       JOIN questions q ON q.id = sa.question_id
       WHERE sa.competition_id = $1 AND sa.student_id = ANY($2::uuid[])
       GROUP BY sa.student_id`,
      [competition_id, studentIds]
    );

    const currentMap = new Map(ansRes.rows.map((r) => [r.student_id, r.current_question]));

    const players = scRes.rows.map((r) => {
      const s = studsRes.rows.find((s) => s.id === r.student_id);
      return {
        student_id: r.student_id,
        name: s ? s.name : r.student_id,
        total_marks: r.total_marks || 0,
        current_question: currentMap.get(r.student_id) || null,
      };
    });

    client.release();
    res.json(players);
  } catch (err) {
    console.error('Players API error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Student login - accepts JSON { username, password }
app.post('/student/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  try {
    const client = await pool.connect();

    // Check students table for matching username and password
    const q = `SELECT id, name FROM students WHERE username = $1 AND password = $2 LIMIT 1`;
    const r = await client.query(q, [username, password]);
    client.release();

    if (r.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' });

    const user = r.rows[0];
    res.json({ id: user.id, name: user.name });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Players API running on http://localhost:${port}`);
});
