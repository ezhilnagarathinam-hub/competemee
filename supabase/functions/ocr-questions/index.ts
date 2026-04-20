const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isDoc = file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isImage && !isPdf && !isDoc) {
      return new Response(JSON.stringify({ error: 'Supported formats: JPG, PNG, WEBP, PDF, DOC, DOCX' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Analyze this document/image of a question paper. Extract ALL questions in MCQ (Multiple Choice Question) format.

For each question, identify:
1. The question text (support Tamil, English, or mixed languages)
2. Option A
3. Option B  
4. Option C
5. Option D
6. The correct answer if visible (A, B, C, or D)
7. An explanation for the correct answer if available

Return the response as a JSON array with this exact structure:
[
  {
    "question_text": "The question text here",
    "option_a": "First option",
    "option_b": "Second option", 
    "option_c": "Third option",
    "option_d": "Fourth option",
    "correct_answer": "A" or null if not visible,
    "marks": 1,
    "explanation": "Why this answer is correct" or null if not available
  }
]

Important:
- Preserve Tamil and other language characters exactly as written
- If an image has math symbols or equations, describe them clearly
- If correct answer is marked/highlighted, include it
- If explanation is provided, include it
- CRITICAL — STRIP NUMBERING: Remove any leading question numbers from question_text (e.g. "1.", "Q1.", "Q. 1)", "Question 5:", "5)", "(12)", "Q.No.7"). Also remove "Passage 1", "Passage No. 2", "Case 3:", "Comprehension 1" labels — keep only the passage content. Do NOT strip numbering that is part of the question content itself (statement numerals like "I.", "II.", or numbers inside sentences). The platform displays its own question number; keeping the original causes double-numbering.
- Return ONLY the JSON array, no other text`;

    // Build content array based on file type
    const content: any[] = [{ type: 'text', text: prompt }];

    if (isDoc) {
      // For DOC/DOCX files, extract raw text from the binary and send as text
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Extract readable text from DOCX (which is a ZIP containing XML)
      let extractedText = '';
      try {
        extractedText = extractTextFromDocx(bytes);
      } catch {
        // Fallback: extract any readable ASCII/UTF text from the binary
        extractedText = extractRawText(bytes);
      }
      
      if (extractedText.trim().length < 10) {
        return new Response(JSON.stringify({ error: 'Could not extract text from document. Try converting to PDF or image first.' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      content.push({
        type: 'text',
        text: `Here is the extracted text from the document:\n\n${extractedText}`
      });
    } else {
      // For images and PDFs, send as base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      const mimeType = file.type || 'image/png';

      content.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` }
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content,
          }
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const responseContent = aiResponse.choices?.[0]?.message?.content || '';

    // Parse the JSON from the response
    let questions = [];
    try {
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Failed to parse questions from file',
        raw_content: responseContent 
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('OCR Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Extract text from DOCX (ZIP containing XML files)
function extractTextFromDocx(bytes: Uint8Array): string {
  // DOCX is a ZIP file. Find the document.xml entry and extract text from XML tags.
  const zipData = bytes;
  const textParts: string[] = [];
  
  // Find PK signatures and locate document.xml
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const fullText = decoder.decode(zipData);
  
  // Look for XML content between word/document.xml markers
  // Extract text from <w:t> tags which contain the actual text in DOCX
  const wtMatches = fullText.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
  for (const match of wtMatches) {
    if (match[1]) {
      textParts.push(match[1]);
    }
  }
  
  if (textParts.length > 0) {
    // Join with spaces, but detect paragraph breaks from </w:p> tags
    let result = '';
    const paragraphs = fullText.split('</w:p>');
    for (const para of paragraphs) {
      const paraTexts: string[] = [];
      const matches = para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      for (const m of matches) {
        if (m[1]) paraTexts.push(m[1]);
      }
      if (paraTexts.length > 0) {
        result += paraTexts.join('') + '\n';
      }
    }
    return result;
  }
  
  return '';
}

// Fallback: extract any readable text from binary
function extractRawText(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(bytes);
  // Filter to only readable characters
  return text.replace(/[^\x20-\x7E\n\r\t\u0B80-\u0BFF\u0900-\u097F]/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim();
}
