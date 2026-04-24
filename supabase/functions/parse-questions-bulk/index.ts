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
