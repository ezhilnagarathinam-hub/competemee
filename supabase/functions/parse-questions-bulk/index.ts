const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return new Response(JSON.stringify({ error: 'Please provide bulk question text to parse' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Split very large pasted text into chunks so each AI call stays within output limits.
    // ~12k chars ≈ 20-25 questions per chunk → supports up to ~100 questions reliably.
    const CHUNK_SIZE = 12000;
    const chunks = splitIntoChunks(text, CHUNK_SIZE);

    const results = await Promise.all(
      chunks.map((chunk) => parseChunk(chunk, apiKey))
    );

    const questions = results.flat();

    if (questions.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Bulk parse error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function stripFences(s: string): string {
  return s
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/'''(?:json)?\s*/gi, '')
    .replace(/```\s*$/g, '')
    .replace(/'''\s*$/g, '')
    .trim();
}

function tryParseJson(s: string): any | null {
  try { return JSON.parse(s); } catch { /* noop */ }
  // common repairs
  let cleaned = s
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  try { return JSON.parse(cleaned); } catch { return null; }
}

// Salvage complete question objects from a possibly-truncated JSON array body
function salvageQuestions(text: string): any[] {
  const results: any[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.substring(start, i + 1);
        const obj = tryParseJson(candidate);
        if (obj && typeof obj === 'object' && 'question_text' in obj) {
          results.push(obj);
        }
        start = -1;
      }
    }
  }
  return results;
}

function extractQuestions(raw: string): any[] {
  const cleaned = stripFences(raw);

  // 1) try full object parse
  const objStart = cleaned.search(/[\{\[]/);
  if (objStart !== -1) {
    const slice = cleaned.substring(objStart);
    const parsed = tryParseJson(slice);
    if (parsed) {
      if (Array.isArray(parsed?.questions)) return parsed.questions;
      if (Array.isArray(parsed)) return parsed;
    }
  }

  // 2) salvage individual question objects (handles truncation)
  return salvageQuestions(cleaned);
}

// Split text on blank lines so we never cut a question in half.
function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buf = '';
  for (const p of paragraphs) {
    if (buf.length + p.length + 2 > maxLen && buf.length > 0) {
      chunks.push(buf);
      buf = '';
    }
    // single paragraph larger than maxLen → hard split
    if (p.length > maxLen) {
      if (buf) { chunks.push(buf); buf = ''; }
      for (let i = 0; i < p.length; i += maxLen) {
        chunks.push(p.substring(i, i + maxLen));
      }
      continue;
    }
    buf += (buf ? '\n\n' : '') + p;
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function parseChunk(text: string, apiKey: string): Promise<any[]> {
  const prompt = `You are a bulk question parser for an MCQ exam platform. The pasted text contains MULTIPLE questions (up to ~25 in this chunk). Extract EVERY single question — do not stop early, do not summarize, do not skip any.

Each question may include:
- A passage/case/stimulus followed by one or more related questions
- Question text (assertion-reason, multi-statement, direct, fill-in-the-blank, mixed Tamil/English, etc.)
- Four options (A/B/C/D, 1/2/3/4, a/b/c/d, or similar)
- A correct answer ("Answer: A", "Correct: B", "Ans - C")
- An explanation ("Explanation:", "Reason:", "Solution:" — optional)

For passage-based questions, include the relevant passage/case text together with each related question inside question_text so nothing is lost.

CRITICAL — STRIP ALL NUMBERING:
- Remove leading question numbers from question_text ("1.", "Q1.", "Q. 1)", "Question 5:", "5)", "(12)", "12 -", "Q.No.7" etc.). The platform shows its own number; keeping the original causes double-numbering.
- Remove "Passage 1", "Passage No. 2", "Case 3:", "Set II:", "Comprehension 1" labels at the start of a passage. Keep only the passage content.
- Do NOT remove numbering that is part of question content (statement numerals "I.", "II.", "1.", "2." inside multi-statement questions, or numbers inside sentences like "In 1947, ...").
- Trim whitespace after stripping.

Return ONLY a JSON object (no markdown, no fences) with this exact structure:
{
  "questions": [
    {
      "question_text": "Full question text",
      "option_a": "First option text only (no A. prefix)",
      "option_b": "Second option text",
      "option_c": "Third option text",
      "option_d": "Fourth option text",
      "correct_answer": "A" | "B" | "C" | "D" | null,
      "explanation": "Explanation text" | null
    }
  ]
}

Pasted text:
${text}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      console.error('AI Gateway error in chunk:', response.status, await response.text());
      return [];
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    return extractQuestions(content);
  } catch (e) {
    console.error('parseChunk failed:', e);
    return [];
  }
}
