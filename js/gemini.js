// gemini.js — API REST Gemini: analizza una foto e restituisce metadati strutturati

const GEMINI_MODEL = 'gemini-2.0-flash'; // Modello gratuito — verifica su aistudio.google.com
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Categorie di default usate quando l'utente non ha ancora cartelle su Drive
const DEFAULT_CATEGORIES = [
  'Scontrini', 'Bollette', 'Fatture', 'Analisi', 'Esami',
  'Ricette', 'Auto', 'Assicurazioni', 'Altro',
];

function buildPrompt(categories) {
  const catList = (categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES)
    .map(c => `"${c}"`).join(', ');
  return `Analizza questa immagine di un documento.
Restituisci SOLO un oggetto JSON valido con questi campi:
- categoria: scegli il valore più adatto tra: ${catList}
- descrizione: stringa breve e descrittiva (es. "Caldaia Baxi ECO5", "Bolletta acqua Q1 2026", "Ricetta medica Dr. Rossi")
- tag: array di 2-4 stringhe lowercase specifiche al contenuto (es. ["garanzia", "caldaia", "riscaldamento"] oppure ["esame", "sangue", "colesterolo"])
- importo: stringa con importo in euro se visibile, altrimenti ""
- data: stringa in formato YYYY-MM-DD se visibile, altrimenti ""

Nessun testo aggiuntivo, solo JSON.`;
}

async function analyzePhoto(base64DataUrl, categories = []) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API key not set');

  // Rimuove il prefisso "data:image/jpeg;base64,"
  const base64Data = base64DataUrl.split(',')[1];
  const mimeType = base64DataUrl.split(';')[0].split(':')[1]; // es. "image/jpeg"

  const body = {
    contents: [{
      parts: [
        { text: buildPrompt(categories) },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]
    }]
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    // Rimuove eventuali delimitatori markdown
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text}`);
  }
}

async function analyzeAllPhotos(photos, categories = []) {
  const results = [];
  for (const photo of photos) {
    try {
      const metadata = await analyzePhoto(photo, categories);
      results.push({ photo, metadata, error: null });
    } catch (err) {
      results.push({ photo, metadata: null, error: err.message });
    }
  }
  return results;
}
