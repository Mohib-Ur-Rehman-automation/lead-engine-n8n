// Hand the AI's raw answer to L0. If the AI failed or timed out, ai is '' -> adjust 0.
const result = $('L0: process').first().json;
const j = $input.first().json || {};
const ai = j.error ? '' : (j.text || '');
return [{ json: { action: 'ai_adjust', data: { result, ai } } }];
