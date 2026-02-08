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
 
    // Convert file to base64 in chunks to avoid stack overflow
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
 
     // Call Lovable AI Gateway for OCR
     const apiKey = Deno.env.get('LOVABLE_API_KEY');
     if (!apiKey) {
       throw new Error('LOVABLE_API_KEY not configured');
     }
 
     const prompt = `Analyze this image of a question paper. Extract ALL questions in MCQ (Multiple Choice Question) format.
 
 For each question, identify:
 1. The question text (support Tamil, English, or mixed languages)
 2. Option A
 3. Option B  
 4. Option C
 5. Option D
 6. The correct answer if visible (A, B, C, or D)
 
 Return the response as a JSON array with this exact structure:
 [
   {
     "question_text": "The question text here",
     "option_a": "First option",
     "option_b": "Second option", 
     "option_c": "Third option",
     "option_d": "Fourth option",
     "correct_answer": "A" or null if not visible,
     "marks": 1
   }
 ]
 
 Important:
 - Preserve Tamil and other language characters exactly as written
 - If an image has math symbols or equations, describe them clearly
 - If correct answer is marked/highlighted, include it
 - Return ONLY the JSON array, no other text`;
 
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
             content: [
               { type: 'text', text: prompt },
               {
                 type: 'image_url',
                 image_url: { url: `data:${mimeType};base64,${base64}` }
               }
             ]
           }
         ],
         max_tokens: 4000,
       }),
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
     }
 
     const aiResponse = await response.json();
     const content = aiResponse.choices?.[0]?.message?.content || '';
 
     // Parse the JSON from the response
     let questions = [];
     try {
       // Try to extract JSON from the response
       const jsonMatch = content.match(/\[[\s\S]*\]/);
       if (jsonMatch) {
         questions = JSON.parse(jsonMatch[0]);
       }
     } catch (parseError) {
       console.error('Failed to parse AI response:', parseError);
       return new Response(JSON.stringify({ 
         error: 'Failed to parse questions from image',
         raw_content: content 
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