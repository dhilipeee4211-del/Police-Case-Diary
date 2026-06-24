import express from 'express';
import path from 'path';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Multer for in-memory file storage robustly for ESM / CJS interop
const multerFn = typeof multer === 'function' ? multer : (multer as any).default || multer;
const storage = (multerFn.memoryStorage || (multer as any).memoryStorage)();
const upload = multerFn({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB limit
  },
});

// JSON parsing middleware with increased limit for base64 files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API: Parse / Extract PDF details using Gemini 2.5 Flash
app.post('/api/extract', upload.single('file'), async (req, res) => {
  try {
    let base64Pdf = '';
    let fileName = '';

    if (req.file) {
      base64Pdf = req.file.buffer.toString('base64');
      fileName = req.file.originalname;
    } else if (req.body && req.body.file) {
      base64Pdf = req.body.file;
      fileName = req.body.filename || 'uploaded.pdf';
    } else {
      return res.status(400).json({ error: 'No file uploaded or provided in the payload.' });
    }

    if (!fileName.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are supported' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY environment variable is not configured. Please define it in your Secrets.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Analyze the uploaded Tamil Nadu Police Case Diary PDF document and extract ALL distinct case diary entries or hearing records contained in it.
Note that a single PDF may contain multiple separate case diaries (e.g., with different CR. Nos, different pages, or distinct hearing dates).

Extract the details of EVERY case diary entry found into a structured JSON array matching this exact schema shape:
[
  {
    "policeStation": "Name of Police Station",
    "district": "Name of District",
    "crNoAndSecOfLaw": "CR. NO. & SEC. OF LAW (e.g. 0288/2018, U/s 143,341 IPC)",
    "dateTimeAndPlaceOfOccurrence": "Date, Time & Place of Occurrence details",
    "dateOfCd": "DATE OF CD",
    "dateOfReportTime": "DATE OF REPORT / TIME",
    "complainant": "COMPLAINANT details (Name, Age, S/O or W/O, Address)",
    "accusedList": [
      { "sNo": "1", "nameAndAddress": "Name and address of accused" }
    ],
    "propertyLostDetails": "PROPERTY LOST DETAILS",
    "recoveredPropertyDetails": "RECOVERED PROPERTY DETAILS",
    "dateOfPreviousCaseDiary": "DATE OF PREVIOUS CASE DIARY",
    "stageOfTheCase": "STAGE OF THE CASE (e.g., PENDING TRIAL, CASE DISPOSED)",
    "courtRefNo": "COURT REF. NO.",
    "hearingNo": "HEARING NO.",
    "courtNameAndPlace": "COURT NAME AND PLACE",
    "whetherMagistratePresent": "YES or NO",
    "whetherAppPpPresent": "YES or NO",
    "whetherDefenceCounselPresent": "YES or NO",
    "noOfPwsCited": "Number of PWs cited",
    "noOfPwsExaminedSoFar": "Number of PWs examined so far",
    "noOfPwsExaminedToday": "Number of PWs examined today",
    "totalNoOfAccusedCharged": "Total accused charged",
    "noOfAccusedPresent": "Number of accused present",
    "noOfAccusedAbsent": "Number of accused absent",
    "remarks": "Transcribe the REMARKS section exactly as written in the original document (typically in Tamil). Do not force or auto-translate it; keep it exactly as in the PDF.",
    "postedFor": "POSTED FOR (e.g. ACCUSED APPEARANCE, CROSS EXAMINATION)",
    "nextHearingDate": "NEXT HEARING DATE",
    "attendedBy": "ATTENDED BY (e.g. RAJU R(HC))"
  }
]

Ensure that you:
1. Parse every page thoroughly. Do not skip any case diaries.
2. Group the remarks and page remarks accurately with their corresponding case diary entry (by matching dates, page headers, or CR Nos).
3. Do not force English translations on the Tamil remarks; keep the original Tamil text exactly as written.
4. Keep the JSON output perfectly formatted without any trailing commas or syntax errors.
`;

    const modelsToTry = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
    let lastError: any = null;
    let extractedData: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting document extraction with model: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                data: base64Pdf,
                mimeType: 'application/pdf',
              },
            },
            prompt,
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini API returned an empty response.');
        }

        // Try parsing the response directly
        extractedData = JSON.parse(responseText.trim());
        console.log(`Successfully extracted document contents using model: ${modelName}`);
        break; // Exit the loop on success
      } catch (err: any) {
        console.warn(`Model ${modelName} failed or was overloaded:`, err.message || err);
        lastError = err;
      }
    }

    if (!extractedData) {
      throw new Error(
        lastError?.message || 'All attempted Gemini models returned errors or were unavailable due to high demand. Please try again in a moment.'
      );
    }

    return res.json({ success: true, data: extractedData });
  } catch (error: any) {
    console.error('Extraction error:', error);
    return res.status(500).json({
      error: 'Failed to extract document contents. ' + (error.message || ''),
    });
  }
});

// Error handling middleware for clean JSON errors instead of HTML fallback
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express global error handler:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An internal server error occurred during formatting reconstruction.',
  });
});

// Setup Vite Dev server middleware or serve production assets
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
