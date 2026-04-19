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

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Please provide question text to parse' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `You are a question parser for an MCQ exam platform. Parse the following pasted text and extract the structured question data.

The text may contain:
- A question (could be assertion-reason, multi-statement, direct, fill-in-the-blank, or any MCQ format)
- Four options (A, B, C, D) — they may be labeled with A/B/C/D, 1/2/3/4, a/b/c/d, or similar
- A correct answer (may be stated as "Answer: A" or "Correct: B" etc.)
- An explanation (may be labeled "Explanation:", "Reason:", "Solution:" etc.)

Use intelligence to understand the format. The question might be:
- Assertion & Reason type: "Assertion (A): ... Reason (R): ... Choose the correct option"
- Multi-statement: "Consider the following statements: I. ... II. ... Which of the above is/are correct?"
- Standard MCQ with options
- Mixed Tamil/English content
- Passage-based questions where a passage/case/stimulus appears before the question

If a passage is present, include BOTH the full passage and the actual question together inside question_text in the correct reading order.
Do not put passage text into options, answer, or explanation.

Return a JSON object with this exact structure:
{
  "question_text": "The full question text including any passage/case, assertion/reason, and statements",
  "option_a": "First option text only (without A. or 1. prefix)",
  "option_b": "Second option text only",
  "option_c": "Third option text only", 
  "option_d": "Fourth option text only",
  "correct_answer": "A" or "B" or "C" or "D" or null if not found,
  "explanation": "The explanation text" or null if not found
}

Return ONLY the JSON object, no other text.

Here is the pasted text:
${text}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    let parsed = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: content }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Parse error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
