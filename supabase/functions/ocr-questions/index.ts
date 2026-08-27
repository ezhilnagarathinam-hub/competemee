import { unzipSync } from 'npm:fflate@0.8.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
          question_text_secondary: { type: 'string' },
          option_a_secondary: { type: 'string' },
          option_b_secondary: { type: 'string' },
          option_c_secondary: { type: 'string' },
          option_d_secondary: { type: 'string' },
          explanation_secondary: { type: 'string' },
          secondary_language: { type: 'string', enum: ['tamil', 'hindi', ''] },
        },
        required: ['question_text', 'option_a', 'option_b', 'option_c', 'option_d'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

const INSTRUCTIONS = `You are extracting MCQ questions from a question paper.

Rules:
- Extract EVERY question. Each record MUST contain the question text and all 4 options (A, B, C, D).
- NEVER split one question across two records, and never emit a record that only holds options.
- Put the correct answer letter in correct_answer when it is marked, given in an answer key, or stated in the explanation.
- Put the explanation / solution text in "explanation" (never inside the question or an option).
- Strip leading question numbers ("1.", "Q1)", "Question 5:", "Q.No.7", "(12)") and labels like "Passage 1", "Case 3:". Keep statement numerals (I., II., 1., 2.) that are part of the question body.
- Preserve Tamil / Hindi / math characters exactly.
- If the paper repeats each question in two languages (English + Tamil, or English + Hindi), put the English version in the primary fields, the other language in the *_secondary fields, and set secondary_language to "tamil" or "hindi".
- Do not invent questions. Return ONLY JSON matching the schema.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return json({ error: 'No file provided' }, 400);
    }

    const name = (file.name || '').toLowerCase();
    const type = file.type || '';
    const isImage = type.startsWith('image/');
    const isPdf = type === 'application/pdf' || name.endsWith('.pdf');
    const isDocx =
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx');
    const isDoc = type === 'application/msword' || name.endsWith('.doc');

    if (!isImage && !isPdf && !isDocx && !isDoc) {
      return json({ error: 'Supported formats: JPG, PNG, WEBP, PDF, DOC, DOCX' }, 400);
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    const bytes = new Uint8Array(await file.arrayBuffer());

    let questions: any[] = [];

    if (isDocx || isDoc) {
      let text = '';
      if (isDocx) {
        try {
          text = extractTextFromDocx(bytes);
        } catch (e) {
          console.error('docx unzip failed', e);
        }
      }
      if (text.trim().length < 20) text = extractRawText(bytes);

      if (text.trim().length < 20) {
        return json(
          { error: 'Could not read any text from this document. Please save it as PDF and upload again.' },
          422,
        );
      }

      const chunks = splitIntoChunks(text, 6000);
      for (const chunk of chunks) {
        const parsed = await callAi(
          apiKey,
          [{ type: 'text', text: `${INSTRUCTIONS}\n\nDocument text:\n\n${chunk}` }],
        );
        if (parsed.error) return json({ error: parsed.error }, parsed.status || 500);
        questions.push(...parsed.questions);
      }
    } else {
      // PDF or image — send the binary to the vision model.
      const base64 = toBase64(bytes);
      const mimeType = isPdf ? 'application/pdf' : type || 'image/png';

      const attempts: any[][] = isPdf
        ? [
            [
              { type: 'text', text: INSTRUCTIONS },
              {
                type: 'file',
                file: { filename: file.name || 'paper.pdf', file_data: `data:application/pdf;base64,${base64}` },
              },
            ],
            [
              { type: 'text', text: INSTRUCTIONS },
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } },
            ],
          ]
        : [
            [
              { type: 'text', text: INSTRUCTIONS },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          ];

      let lastError = '';
      let lastStatus = 500;
      for (const content of attempts) {
        const parsed = await callAi(apiKey, content);
        if (parsed.error) {
          lastError = parsed.error;
          lastStatus = parsed.status || 500;
          continue;
        }
        if (parsed.questions.length > 0) {
          questions = parsed.questions;
          break;
        }
        lastError = 'No questions could be read from this file.';
        lastStatus = 422;
      }

      if (questions.length === 0) {
        return json(
          {
            error:
              lastStatus === 402 || lastStatus === 429
                ? lastError
                : `${lastError || 'Could not read this PDF.'} If the PDF is a scan, try uploading the pages as images.`,
          },
          lastStatus === 402 || lastStatus === 429 ? lastStatus : 422,
        );
      }
    }

    questions = mergeSplitQuestions(questions)
      .map(sanitizeQuestion)
      .filter((q): q is any => !!q && !!q.question_text && !!q.option_a && !!q.option_b && !!q.option_c && !!q.option_d);

    if (questions.length === 0) {
      return json({ error: 'No complete questions could be extracted from this file.' }, 422);
    }

    return json({ questions });
  } catch (error) {
    console.error('OCR Error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function callAi(
  apiKey: string,
  content: any[],
): Promise<{ questions: any[]; error?: string; status?: number }> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content }],
        max_tokens: 16000,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'questions', strict: true, schema: QUESTION_SCHEMA },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 402) {
        return { questions: [], error: 'AI credits exhausted. Please top up your Lovable AI credits.', status: 402 };
      }
      if (response.status === 429) {
        return { questions: [], error: 'AI rate limit reached. Please retry in a moment.', status: 429 };
      }
      return { questions: [], error: `AI service error (${response.status})`, status: response.status };
    }

    const aiResponse = await response.json();
    const raw = aiResponse.choices?.[0]?.message?.content || '';
    return { questions: extractQuestions(raw) };
  } catch (e) {
    console.error('callAi failed', e);
    return { questions: [], error: e instanceof Error ? e.message : 'AI request failed', status: 500 };
  }
}

// ---------- text extraction ----------

function extractTextFromDocx(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const parts: string[] = [];

  const names = Object.keys(files)
    .filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n) || /^word\/document\d*\.xml$/.test(n))
    .sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b)));

  for (const n of names) {
    parts.push(xmlToText(decoder.decode(files[n])));
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]{2,}/g, ' ');
}

function extractRawText(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder
    .decode(bytes)
    .replace(/[^\x20-\x7E\n\r\t\u0B80-\u0BFF\u0900-\u097F]/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim();
}

function splitIntoChunks(text: string, size: number): string[] {
  const boundary = /(?=^\s*(?:Q(?:uestion)?\.?\s*)?\d{1,3}\s*[\).:-])/gim;
  const blocks = text.split(boundary).filter((b) => b.trim().length > 0);
  const chunks: string[] = [];
  let current = '';
  for (const block of blocks) {
    if (current.length + block.length > size && current.trim().length > 0) {
      chunks.push(current);
      current = '';
    }
    current += block;
  }
  if (current.trim().length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

// ---------- post-processing (same rules as the bulk parser) ----------

function optionCount(q: any): number {
  return ['option_a', 'option_b', 'option_c', 'option_d'].filter(
    (k) => String(q?.[k] || '').trim().length > 0,
  ).length;
}

function looksLikeFragment(q: any): boolean {
  const t = String(q?.question_text || '').trim();
  if (t.length === 0) return true;
  if (/^(?:[A-Da-d1-4][\).]?|\(?[A-Da-d1-4]\)|Q?\.?\s*\d+[\).:-]?)$/.test(t)) return true;
  return t.length < 12 && optionCount(q) >= 3;
}

function mergeSplitQuestions(list: any[]): any[] {
  const out: any[] = [];
  for (let i = 0; i < list.length; i++) {
    const cur = { ...(list[i] || {}) };
    const next = list[i + 1];

    if (optionCount(cur) < 4 && next && optionCount(next) >= 3 && looksLikeFragment(next)) {
      for (const k of ['option_a', 'option_b', 'option_c', 'option_d']) {
        if (!String(cur[k] || '').trim()) cur[k] = next[k];
      }
      if (!cur.correct_answer && next.correct_answer) cur.correct_answer = next.correct_answer;
      if (!cur.explanation && next.explanation) cur.explanation = next.explanation;
      i++;
      out.push(cur);
      continue;
    }

    if (looksLikeFragment(cur)) {
      const prev = out[out.length - 1];
      if (prev && optionCount(prev) < 4 && optionCount(cur) > 0) {
        for (const k of ['option_a', 'option_b', 'option_c', 'option_d']) {
          if (!String(prev[k] || '').trim()) prev[k] = cur[k];
        }
        if (!prev.correct_answer && cur.correct_answer) prev.correct_answer = cur.correct_answer;
        if (!prev.explanation && cur.explanation) prev.explanation = cur.explanation;
      }
      continue;
    }

    out.push(cur);
  }

  const seen = new Set<string>();
  return out.filter((q) => {
    const key = (String(q.question_text || '').trim() + '||' + String(q.option_a || '').trim()).toLowerCase();
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripNumbering(s: string): string {
  return s
    .replace(/^\s*(?:Q(?:uestion)?\s*\.?\s*(?:No\.?)?\s*)?\(?\d{1,3}\)?\s*[\).:\-–]\s*/i, '')
    .replace(/^\s*(?:Passage|Case|Comprehension)\s*(?:No\.?)?\s*\d{1,3}\s*[:.\-–]?\s*/i, '')
    .trim();
}

function stripOptionLabel(s: string): string {
  return s.replace(/^\s*\(?[A-Da-d1-4]\)?\s*[\).:\-–]?\s+/, '').trim();
}

function sanitizeQuestion(q: any): any | null {
  if (!q || typeof q !== 'object') return null;
  const out: any = {
    question_text: stripNumbering(String(q.question_text || '').trim()),
    option_a: stripOptionLabel(String(q.option_a || '').trim()),
    option_b: stripOptionLabel(String(q.option_b || '').trim()),
    option_c: stripOptionLabel(String(q.option_c || '').trim()),
    option_d: stripOptionLabel(String(q.option_d || '').trim()),
    correct_answer: ['A', 'B', 'C', 'D'].includes(q.correct_answer) ? q.correct_answer : null,
    explanation: q.explanation ? String(q.explanation).trim() : null,
    marks: 1,
  };

  const sec = String(q.secondary_language || '').toLowerCase();
  if (sec === 'tamil' || sec === 'hindi') {
    const hasSecondary =
      String(q.question_text_secondary || '').trim() &&
      String(q.option_a_secondary || '').trim() &&
      String(q.option_b_secondary || '').trim() &&
      String(q.option_c_secondary || '').trim() &&
      String(q.option_d_secondary || '').trim();
    if (hasSecondary) {
      out.secondary_language = sec;
      out.question_text_secondary = stripNumbering(String(q.question_text_secondary).trim());
      out.option_a_secondary = stripOptionLabel(String(q.option_a_secondary).trim());
      out.option_b_secondary = stripOptionLabel(String(q.option_b_secondary).trim());
      out.option_c_secondary = stripOptionLabel(String(q.option_c_secondary).trim());
      out.option_d_secondary = stripOptionLabel(String(q.option_d_secondary).trim());
      if (q.explanation_secondary) out.explanation_secondary = String(q.explanation_secondary).trim();
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
  try {
    return JSON.parse(s);
  } catch { /* noop */ }
  const cleaned = s
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
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
        const obj = tryParseJson(text.substring(start, i + 1));
        if (obj && typeof obj === 'object' && 'question_text' in obj) results.push(obj);
        start = -1;
      }
    }
  }
  return results;
}

function extractQuestions(raw: string): any[] {
  if (!raw) return [];
  const cleaned = stripFences(raw);
  const objStart = cleaned.search(/[\{\[]/);
  if (objStart !== -1) {
    const parsed = tryParseJson(cleaned.substring(objStart));
    if (parsed) {
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.questions)) return parsed.questions;
    }
  }
  return salvageQuestions(cleaned);
}
