const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strict JSON schema for the AI to fill. This eliminates the "options spilling
// into the next question" / wrong-count issues we were seeing.
const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question_text: { type: 'string' },
          option_a: { type: 'string' },
          option_b: { type: 'string' },
          option_c: { type: 'string' },
          option_d: { type: 'string' },
          correct_answer: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          explanation: { type: 'string' },

          // Bilingual pair (optional). When the source paper has each question
          // in two languages (English + Tamil OR English + Hindi), the AI must
          // put the SECOND language version here AND set secondary_language.
          // Primary fields above must always be the English version when
          // English is present.
          question_text_secondary: { type: 'string' },
          option_a_secondary: { type: 'string' },
          option_b_secondary: { type: 'string' },
          option_c_secondary: { type: 'string' },
          option_d_secondary: { type: 'string' },
          explanation_secondary: { type: 'string' },
          secondary_language: { type: 'string', enum: ['tamil', 'hindi', ''] },
        },
        required: [
          'question_text',
          'option_a',
          'option_b',
          'option_c',
          'option_d',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
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

    // Smaller, safer chunks. Past failures (101/108 questions, options drifting
    // into the next item) were caused by chunks too large for the model to
    // keep aligned. ~6k chars ≈ 10–14 questions per chunk.
    const CHUNK_SIZE = 6000;
    const chunks = splitIntoChunks(text, CHUNK_SIZE);

    const results: any[][] = [];
    for (const chunk of chunks) {
      // eslint-disable-next-line no-await-in-loop
      const parsed = await parseChunk(chunk, apiKey);
      if (parsed && (parsed as any).__error) {
        return new Response(JSON.stringify({ error: (parsed as any).__error }), {
          status: (parsed as any).__status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      results.push(parsed as any[]);
    }

    let questions = results.flat();

    // Sanity-clean every question so options can NEVER be empty just because
    // the model accidentally split them across two records.
    questions = questions
      .map(sanitizeQuestion)
      .filter((q) => q && q.question_text && q.option_a && q.option_b && q.option_c && q.option_d);

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

function sanitizeQuestion(q: any): any | null {
  if (!q || typeof q !== 'object') return null;
  const out: any = {
    question_text: String(q.question_text || '').trim(),
    option_a: String(q.option_a || '').trim(),
    option_b: String(q.option_b || '').trim(),
    option_c: String(q.option_c || '').trim(),
    option_d: String(q.option_d || '').trim(),
    correct_answer: ['A', 'B', 'C', 'D'].includes(q.correct_answer) ? q.correct_answer : null,
    explanation: q.explanation ? String(q.explanation).trim() : null,
  };

  const sec = String(q.secondary_language || '').toLowerCase();
  if (sec === 'tamil' || sec === 'hindi') {
    const hasSecondary =
      (q.question_text_secondary || '').trim() &&
      (q.option_a_secondary || '').trim() &&
      (q.option_b_secondary || '').trim() &&
      (q.option_c_secondary || '').trim() &&
      (q.option_d_secondary || '').trim();
    if (hasSecondary) {
      out.secondary_language = sec;
      out.question_text_secondary = String(q.question_text_secondary).trim();
      out.option_a_secondary = String(q.option_a_secondary).trim();
      out.option_b_secondary = String(q.option_b_secondary).trim();
      out.option_c_secondary = String(q.option_c_secondary).trim();
      out.option_d_secondary = String(q.option_d_secondary).trim();
      if (q.explanation_secondary) {
        out.explanation_secondary = String(q.explanation_secondary).trim();
      }
    }
  }

  return out;
}

function stripFences(s: string): string {
  return s
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*$/g, '')
    .trim();
}

function tryParseJson(s: string): any | null {
  try { return JSON.parse(s); } catch { /* noop */ }
  let cleaned = s
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  try { return JSON.parse(cleaned); } catch { return null; }
}

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
  const objStart = cleaned.search(/[\{\[]/);
  if (objStart !== -1) {
    const slice = cleaned.substring(objStart);
    const parsed = tryParseJson(slice);
    if (parsed) {
      if (Array.isArray(parsed?.questions)) return parsed.questions;
      if (Array.isArray(parsed)) return parsed;
    }
  }
  return salvageQuestions(cleaned);
}

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

const SYSTEM_PROMPT = `You are an extremely careful MCQ exam paper parser.

YOUR ONE JOB: emit a JSON object that exactly matches the provided schema. Every question MUST have all 4 options filled in. NEVER emit a question with empty options. NEVER split one question's options across two records.

CRITICAL RULES:
1. ONE record per question. If you see 4 options labelled A/B/C/D (or 1/2/3/4, or a/b/c/d), they ALL belong to the SAME question_text directly above them. Do NOT create a new question just because you reached the next paragraph.
2. STRIP all leading question numbers from question_text: "1.", "Q1.", "Q. 1)", "Question 5:", "5)", "(12)", "12 -", "Q.No.7", etc. Also strip "Passage 1", "Case 3:", "Comprehension 1" labels — keep only the passage content.
3. KEEP numbering that is part of question content (statement numerals "I.", "II.", "1.", "2." inside multi-statement questions; numbers inside sentences like "In 1947, ...").
4. For passage-based questions, include the passage text together with each related question inside question_text so context is preserved.
5. Strip the option label prefix ("A.", "A)", "(A)", "1.") from the option value itself.

BILINGUAL DETECTION (very important):
- If the SAME question is given in TWO languages (English+Tamil OR English+Hindi), pair them as ONE record:
  - Put the English version in question_text + option_a..d (and explanation).
  - Put the OTHER language version in question_text_secondary + option_a_secondary..d_secondary (and explanation_secondary).
  - Set secondary_language to "tamil" or "hindi".
- Common bilingual patterns:
  - English question first, then immediately the Tamil/Hindi translation of the SAME question (often with the same numbering, or with markers like "(தமிழில்)", "(हिंदी में)", "Tamil:", "Hindi:").
  - Each option followed by its translation: "A) Apple / ஆப்பிள்" — split on the separator.
- If the paper is single-language only, leave secondary_language as "" and DO NOT fill the secondary fields.
- Never invent a translation. Only fill secondary fields when the source actually contains them.

OUTPUT: Return ONLY the JSON object that satisfies the schema. No markdown, no commentary, no code fences.`;

async function parseChunk(text: string, apiKey: string): Promise<any[]> {
  const userPrompt = `Extract EVERY question from this chunk. Do not skip any. Do not invent any.

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
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 16000,
        // Force structured output. Gemini via Lovable AI gateway supports this
        // and it dramatically reduces split/empty-option errors.
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'parsed_questions', strict: true, schema: QUESTION_SCHEMA },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI Gateway error in chunk:', response.status, errText);
      if (response.status === 402) {
        return { __error: 'AI credits exhausted. Please add credits in Lovable Cloud settings.', __status: 402 } as any;
      }
      if (response.status === 429) {
        return { __error: 'Rate limit reached. Please wait a moment and try again.', __status: 429 } as any;
      }
      return await parseChunkFallback(text, apiKey);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    const list = extractQuestions(content);
    if (list.length === 0) return await parseChunkFallback(text, apiKey);
    return list;
  } catch (e) {
    console.error('parseChunk failed:', e);
    return await parseChunkFallback(text, apiKey);
  }
}

async function parseChunkFallback(text: string, apiKey: string): Promise<any[]> {
  const userPrompt = `Extract every question from the text below into JSON of the form
{"questions":[{"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A|B|C|D|null","explanation":"...|null","question_text_secondary":"...","option_a_secondary":"...","option_b_secondary":"...","option_c_secondary":"...","option_d_secondary":"...","explanation_secondary":"...","secondary_language":"tamil|hindi|"}]}

All 4 options must be present in EVERY question. Never split one question's options into two records. Strip leading question numbers. Detect bilingual pairs (English + Tamil OR English + Hindi) and pair them in the same record using the *_secondary fields.

Return ONLY JSON.

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
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 16000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('AI Gateway fallback error:', response.status, await response.text());
      return [];
    }
    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    return extractQuestions(content);
  } catch (e) {
    console.error('parseChunkFallback failed:', e);
    return [];
  }
}
