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

    const prompt = `You are a bulk question parser for an MCQ exam platform. The following pasted text contains MULTIPLE questions (typically 5-20 of them). Extract every question into a structured array.

Each question may include:
- A passage/case/stimulus followed by one or more related questions
- Question text (could be assertion-reason, multi-statement, direct, fill-in-the-blank, mixed Tamil/English, etc.)
- Four options (labeled A/B/C/D, 1/2/3/4, a/b/c/d, or similar)
- A correct answer (e.g. "Answer: A", "Correct: B", "Ans - C")
- An explanation (labeled "Explanation:", "Reason:", "Solution:" — optional)

For passage-based questions, include the relevant passage/case text together with each related question inside question_text so nothing is lost.

CRITICAL — STRIP ALL NUMBERING:
- Remove any leading question numbers from question_text (e.g. "1.", "Q1.", "Q. 1)", "Question 5:", "5)", "(12)", "12 -", "5 ]", "Q.No.7" etc.). The platform shows its own question number, so keeping the original number causes double-numbering and confuses students.
- Remove any "Passage 1", "Passage No. 2", "Case 3:", "Set II:", "Comprehension 1" style labels at the start of a passage. Keep only the passage content itself.
- Do NOT remove numbering that is part of the actual question content (e.g. statement numerals "I.", "II.", "1.", "2." inside multi-statement questions, or numbers inside the sentence like "In 1947, ..."). Only strip the OUTER question/passage index.
- Trim leading/trailing whitespace after stripping.

Return a JSON object with this exact structure:
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

Rules:
- Extract every question you can find — do not skip any.
- If a shared passage applies to multiple questions, repeat the needed passage context inside each question_text.
- If options are missing for a question, fill empty string "".
- Return ONLY the JSON object, no other text.

Pasted text:
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
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    const questions = extractQuestions(content);

    if (questions.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: content }), {
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
