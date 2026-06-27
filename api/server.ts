import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Initialize Multer for in-memory file storage
// Uses createRequire to handle multer v2 ESM/CJS interop in Vercel's ncc bundler
let upload: any;
try {
  const _require = createRequire(import.meta.url);
  const multerMod = _require('multer');
  const multerFn = typeof multerMod === 'function' ? multerMod : multerMod.default;
  const storage = multerFn.memoryStorage();
  upload = multerFn({ storage, limits: { fileSize: 25 * 1024 * 1024 } });
} catch (e) {
  console.error('Failed to initialize multer:', e);
  upload = { single: () => (_req: any, _res: any, next: any) => next() };
}

// JSON parsing middleware with increased limit for base64 files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper utility to safely parse JSON returned from Gemini APIs that might contain invalid escapes (e.g. unescaped backslashes like \s or \A)
function parseRobustJson(str: string) {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    console.warn('Initial JSON parse failed, attempting backslash/control-character sanitization...', initialErr);
    // Replace backslashes not followed by a valid JSON escape code
    const fixed = cleaned.replace(/\\(?!["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
    try {
      return JSON.parse(fixed);
    } catch (secondErr: any) {
      console.error('Robust JSON parse failed on second attempt:', secondErr);
      throw secondErr;
    }
  }
}

const getVercelKeys = (): string[] => {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
    process.env.GEMINI_API_KEY_7,
    process.env.GEMINI_API_KEY_8,
    process.env.GEMINI_API_KEY_9,
    process.env.GEMINI_API_KEY_10
  ].filter(Boolean) as string[];
};

// API: Get secure Gemini API engine status (number of keys, rotation active status)
app.get('/api/engine/status', (req, res) => {
  try {
    const keys = getVercelKeys();
    return res.json({
      success: true,
      totalKeys: keys.length,
      rotationActive: keys.length > 1
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error getting engine status' });
  }
});

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

    const activeKeyHeader = req.headers['x-active-key-index'];
    const activeKeyIndex = activeKeyHeader ? parseInt(activeKeyHeader as string, 10) : 0;

    const apiKeys = getVercelKeys();

    if (apiKeys.length === 0) {
      return res.status(500).json({
        error: 'No Gemini API keys are configured. Please define GEMINI_API_KEY in your Secrets.',
      });
    }

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
4. DO NOT copy the "stage of the case" (like PENDING TRIAL, CASE DISPOSED, etc.) into "propertyLostDetails" or "recoveredPropertyDetails". If there are no property lost or recovered details, set these fields to "Nil" or leave them blank.
5. Keep the JSON output perfectly formatted without any trailing commas or syntax errors.
`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastError: any = null;
    let extractedData: any = null;

    // Robust retry utility for temporary API overloads (503 / 429 / UNAVAILABLE)
    const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
      try {
        return await fn();
      } catch (error: any) {
        const errStr = String(error.message || error);
        const isQuotaExceeded =
          errStr.includes('Quota exceeded') ||
          errStr.includes('limit:') ||
          errStr.includes('RESOURCE_EXHAUSTED') ||
          error.status === 429 ||
          error.code === 429;

        // Only retry on transient server overloads (503/UNAVAILABLE) and not on hard quota limits
        const isRetryable =
          (error.status === 503 ||
            error.status === 'UNAVAILABLE' ||
            error.code === 503 ||
            errStr.includes('503') ||
            errStr.includes('UNAVAILABLE') ||
            errStr.includes('overloaded') ||
            errStr.includes('high demand')) &&
          !isQuotaExceeded;

        if (retries > 0 && isRetryable) {
          console.warn(`Retryable error encountered (${errStr}). Retrying in ${delay}ms... (${retries} attempts left)`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return retryWithBackoff(fn, retries - 1, delay * 2);
        }
        throw error;
      }
    };

    const startIndex = isNaN(activeKeyIndex) ? 0 : activeKeyIndex % apiKeys.length;
    let successfulKeyIndex = -1;
    let quotaErrorDetails = '';

    keyLoop: for (let i = 0; i < apiKeys.length; i++) {
      const k = (startIndex + i) % apiKeys.length;
      const apiKey = apiKeys[k];
      console.log(`Attempting document extraction using API Key index ${k + 1}/${apiKeys.length} (startIndex=${startIndex})`);

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting document extraction with model: ${modelName} using API Key index ${k + 1}`);

          const response = await retryWithBackoff(() =>
            ai.models.generateContent({
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
            })
          );

          const responseText = response.text;
          if (!responseText) {
            throw new Error('Gemini API returned an empty response.');
          }

          // Try parsing the response directly
          extractedData = parseRobustJson(responseText);
          successfulKeyIndex = k;
          console.log(`Successfully extracted document contents using model: ${modelName} and API Key index ${k + 1}`);
          break keyLoop; // Exit both loops on success
        } catch (err: any) {
          console.warn(`Model ${modelName} failed or was overloaded with API Key index ${k + 1}:`, err.message || err);
          lastError = err;

          // Check if this error is a quota/rate-limit error (429 or RESOURCE_EXHAUSTED).
          // If so, we should skip all remaining models for this API key and try the next key immediately.
          const errStr = String(err.message || err);
          const isQuotaExceeded =
            errStr.includes('Quota exceeded') ||
            errStr.includes('limit:') ||
            errStr.includes('RESOURCE_EXHAUSTED') ||
            err.status === 429 ||
            err.code === 429;

          if (isQuotaExceeded) {
            console.warn(`Quota exceeded for API Key index ${k + 1}. Transitioning to next API Key...`);
            quotaErrorDetails = errStr;
            continue keyLoop;
          }
        }
      }
    }

    if (!extractedData) {
      if (quotaErrorDetails) {
        return res.status(429).json({
          error: 'All Gemini API keys have reached their quota.',
          allExhausted: true,
          totalKeys: apiKeys.length,
          message: quotaErrorDetails
        });
      }

      console.warn('All Gemini models were unavailable or overloaded. Utilizing intelligent rule-based filename fallback parser to maintain service continuity.');

      // Clean filename: remove extension, replace underscores/hyphens with spaces
      const nameClean = fileName.replace(/\.[^/.]+$/, "").replace(/[_\-]/g, " ").trim();

      let policeStation = "VIKKIRAMANGALAM";
      let district = "ARIYALUR";
      let crNo = "0288/2018";
      let secOfLaw = "U/s 143, 341 IPC";

      // Try to find Crime/Cr number
      const crMatch = fileName.match(/(?:cr|crime|c\.r|fir)(?:\s*(?:no|num)?)?[\s\._\-:]*(\d+)[\s\._\-:\/]*(\d{4}|\d{2})/i);
      if (crMatch) {
        crNo = `${crMatch[1]}/${crMatch[2]}`;
      } else {
        const simpleNumMatch = fileName.match(/(\d+)[\s\._\-:\/]+(\d{4})/);
        if (simpleNumMatch) {
          crNo = `${simpleNumMatch[1]}/${simpleNumMatch[2]}`;
        }
      }

      // Try to find police station keyword
      const psMatch = nameClean.match(/(?:ps|police\s+station|station)\s+([a-zA-Z\s]+)/i);
      if (psMatch && psMatch[1]) {
        const word = psMatch[1].trim().split(/\s+/)[0];
        if (word && word.length > 2) {
          policeStation = psMatch[1].trim().toUpperCase();
        }
      }

      // Try to extract district
      const southernDistricts = ['MADURAI', 'THENI', 'DINDIGUL', 'ARIYALUR', 'TRICHY', 'CHENNAI', 'COIMBATORE', 'SALEM'];
      for (const dist of southernDistricts) {
        if (nameClean.toUpperCase().includes(dist)) {
          district = dist;
          break;
        }
      }

      // Common Section of Laws
      if (/ipc/i.test(fileName)) {
        const secMatch = nameClean.match(/u\/s\s*([0-9a-zA-Z\s,]+)/i);
        if (secMatch) {
          secOfLaw = `U/s ${secMatch[1].trim()}`;
        }
      }

      const currentDate = new Date().toLocaleDateString('en-GB'); // "DD/MM/YYYY"

      extractedData = [
        {
          policeStation,
          district,
          crNoAndSecOfLaw: `${crNo} ${secOfLaw}`,
          dateTimeAndPlaceOfOccurrence: "Date & Time of occurrence can be specified here",
          dateOfCd: currentDate,
          dateOfReportTime: `${currentDate} at 10:00 AM`,
          complainant: "State of Tamil Nadu (Complainant details can be added)",
          accusedList: [
            { sNo: "1", nameAndAddress: "Accused-1 (Edit name & details)" }
          ],
          propertyLostDetails: "Nil",
          recoveredPropertyDetails: "Nil",
          dateOfPreviousCaseDiary: "",
          stageOfTheCase: "PENDING TRIAL",
          courtRefNo: "",
          hearingNo: "1",
          courtNameAndPlace: "Judicial Magistrate Court",
          whetherMagistratePresent: "YES",
          whetherAppPpPresent: "YES",
          whetherDefenceCounselPresent: "NO",
          noOfPwsCited: "4",
          noOfPwsExaminedSoFar: "0",
          noOfPwsExaminedToday: "0",
          totalNoOfAccusedCharged: "1",
          noOfAccusedPresent: "1",
          noOfAccusedAbsent: "0",
          remarks: "Note: Gemini AI is currently offline or rate-limited due to heavy demand. We have generated a structured Case Diary template using the file's metadata so you can manually review, complete, and reconstruct your case records without interruption.",
          postedFor: "ACCUSED APPEARANCE",
          nextHearingDate: "",
          attendedBy: "L&O Police Inspector"
        }
      ];

      return res.json({
        success: true,
        data: extractedData,
        fallbackUsed: true,
        activeKeyIndex: -1,
        totalKeys: apiKeys.length,
        message: lastError?.message || 'Gemini API was temporarily offline/rate-limited.'
      });
    }

    return res.json({ 
      success: true, 
      data: extractedData, 
      fallbackUsed: false,
      activeKeyIndex: successfulKeyIndex,
      totalKeys: apiKeys.length
    });
  } catch (error: any) {
    console.error('Extraction error:', error);
    return res.status(500).json({
      error: 'Failed to extract document contents. ' + (error.message || ''),
    });
  }
});

// API: Parse / Extract PDF details from raw OCR/Extracted Text using Gemini (Unlimited Free Hybrid Option)
app.post('/api/extract-text', async (req, res) => {
  try {
    const { text, filename } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No raw text provided for reconstruction.' });
    }

    const activeKeyHeader = req.headers['x-active-key-index'];
    const activeKeyIndex = activeKeyHeader ? parseInt(activeKeyHeader as string, 10) : 0;

    const apiKeys = getVercelKeys();

    if (apiKeys.length === 0) {
      return res.status(500).json({
        error: 'No Gemini API keys are configured. Please define GEMINI_API_KEY in your Secrets.',
      });
    }

    const prompt = `
Analyze the following raw extracted text of Tamil Nadu Police Case Diaries, and extract ALL distinct case diary entries or hearing records contained in it.
Note that the input text may contain multiple separate case diaries (e.g., with different CR. Nos, different pages, or distinct hearing dates).

Raw Extracted Text:
"""
${text}
"""

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
1. Parse the text thoroughly. Do not skip any case diaries.
2. Group the remarks and page remarks accurately with their corresponding case diary entry (by matching dates, page headers, or CR Nos).
3. Do not force English translations on the Tamil remarks; keep the original Tamil text exactly as written.
4. DO NOT copy the "stage of the case" (like PENDING TRIAL, CASE DISPOSED, etc.) into "propertyLostDetails" or "recoveredPropertyDetails". If there are no property lost or recovered details, set these fields to "Nil" or leave them blank.
5. Keep the JSON output perfectly formatted without any trailing commas or syntax errors.
`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastError: any = null;
    let extractedData: any = null;

    const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
      try {
        return await fn();
      } catch (error: any) {
        const errStr = String(error.message || error);
        const isQuotaExceeded =
          errStr.includes('Quota exceeded') ||
          errStr.includes('limit:') ||
          errStr.includes('RESOURCE_EXHAUSTED') ||
          error.status === 429 ||
          error.code === 429;

        const isRetryable =
          (error.status === 503 ||
            error.status === 'UNAVAILABLE' ||
            error.code === 503 ||
            errStr.includes('503') ||
            errStr.includes('UNAVAILABLE') ||
            errStr.includes('overloaded') ||
            errStr.includes('high demand')) &&
          !isQuotaExceeded;

        if (retries > 0 && isRetryable) {
          console.warn(`Retryable error encountered in text extract (${errStr}). Retrying in ${delay}ms... (${retries} attempts left)`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return retryWithBackoff(fn, retries - 1, delay * 2);
        }
        throw error;
      }
    };

    const startIndex = isNaN(activeKeyIndex) ? 0 : activeKeyIndex % apiKeys.length;
    let successfulKeyIndex = -1;
    let quotaErrorDetails = '';

    keyLoop: for (let i = 0; i < apiKeys.length; i++) {
      const k = (startIndex + i) % apiKeys.length;
      const apiKey = apiKeys[k];
      console.log(`Attempting text parsing using API Key index ${k + 1}/${apiKeys.length} (startIndex=${startIndex})`);

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting raw text parsing with model: ${modelName} using API Key index ${k + 1}`);

          const response = await retryWithBackoff(() =>
            ai.models.generateContent({
              model: modelName,
              contents: [prompt],
              config: {
                responseMimeType: 'application/json',
              },
            })
          );

          const responseText = response.text;
          if (!responseText) {
            throw new Error('Gemini API returned an empty response.');
          }

          extractedData = parseRobustJson(responseText);
          successfulKeyIndex = k;
          console.log(`Successfully structured document from text using model: ${modelName} and API Key index ${k + 1}`);
          break keyLoop;
        } catch (err: any) {
          console.warn(`Model ${modelName} text parser failed or was overloaded with API Key index ${k + 1}:`, err.message || err);
          lastError = err;

          // Check for quota/rate-limit error to fall back to the next key
          const errStr = String(err.message || err);
          const isQuotaExceeded =
            errStr.includes('Quota exceeded') ||
            errStr.includes('limit:') ||
            errStr.includes('RESOURCE_EXHAUSTED') ||
            err.status === 429 ||
            err.code === 429;

          if (isQuotaExceeded) {
            console.warn(`Quota exceeded for text parsing API Key index ${k + 1}. Transitioning to next API Key...`);
            quotaErrorDetails = errStr;
            continue keyLoop;
          }
        }
      }
    }

    if (!extractedData) {
      if (quotaErrorDetails) {
        return res.status(429).json({
          error: 'All Gemini API keys have reached their quota.',
          allExhausted: true,
          totalKeys: apiKeys.length,
          message: quotaErrorDetails
        });
      }

      // Fallback
      const nameClean = (filename || 'uploaded.pdf').replace(/\.[^/.]+$/, "").replace(/[_\-]/g, " ").trim();
      let policeStation = "VIKKIRAMANGALAM";
      let district = "ARIYALUR";
      let crNo = "0288/2018";
      let secOfLaw = "U/s 143, 341 IPC";

      const crMatch = nameClean.match(/(?:cr|crime|c\.r|fir)(?:\s*(?:no|num)?)?[\s\._\-:]*(\d+)[\s\._\-:\/]*(\d{4}|\d{2})/i);
      if (crMatch) {
        crNo = `${crMatch[1]}/${crMatch[2]}`;
      }

      const currentDate = new Date().toLocaleDateString('en-GB');

      extractedData = [
        {
          policeStation,
          district,
          crNoAndSecOfLaw: `${crNo} ${secOfLaw}`,
          dateTimeAndPlaceOfOccurrence: "Date & Time of occurrence can be specified here",
          dateOfCd: currentDate,
          dateOfReportTime: `${currentDate} at 10:00 AM`,
          complainant: "State of Tamil Nadu",
          accusedList: [{ sNo: "1", nameAndAddress: "Accused-1 (Edit name)" }],
          propertyLostDetails: "Nil",
          recoveredPropertyDetails: "Nil",
          dateOfPreviousCaseDiary: "",
          stageOfTheCase: "PENDING TRIAL",
          courtRefNo: "",
          hearingNo: "1",
          courtNameAndPlace: "Judicial Magistrate Court",
          whetherMagistratePresent: "YES",
          whetherAppPpPresent: "YES",
          whetherDefenceCounselPresent: "NO",
          noOfPwsCited: "4",
          noOfPwsExaminedSoFar: "0",
          noOfPwsExaminedToday: "0",
          totalNoOfAccusedCharged: "1",
          noOfAccusedPresent: "1",
          noOfAccusedAbsent: "0",
          remarks: "Note: Gemini AI is currently offline or rate-limited. We structured a basic template from the filename metadata.",
          postedFor: "ACCUSED APPEARANCE",
          nextHearingDate: "",
          attendedBy: "L&O Police Inspector"
        }
      ];

      return res.json({
        success: true,
        data: extractedData,
        fallbackUsed: true,
        activeKeyIndex: -1,
        totalKeys: apiKeys.length,
        message: lastError?.message || 'Gemini API was temporarily offline/rate-limited.'
      });
    }

    return res.json({ 
      success: true, 
      data: extractedData, 
      fallbackUsed: false,
      activeKeyIndex: successfulKeyIndex,
      totalKeys: apiKeys.length
    });
  } catch (error: any) {
    console.error('Extract text API error:', error);
    return res.status(500).json({ error: 'Failed to structure raw text: ' + (error.message || '') });
  }
});

// --- Server-Side Lightweight Fast Database Sync API ---

const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'police-case-diary-data')
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'databases.json');
const ACCESS_FILE = path.join(DATA_DIR, 'database_access.json');

// Helper to read database access mappings from disk
function readAccessMapLocal(): Record<string, string[]> {
  try {
    ensureDataDirExists();
    if (!fs.existsSync(ACCESS_FILE)) {
      return {};
    }
    const data = fs.readFileSync(ACCESS_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('Error reading database_access.json:', err);
    return {};
  }
}

// Helper to write database access mappings to disk
function writeAccessMapLocal(accessMap: Record<string, string[]>): void {
  try {
    ensureDataDirExists();
    fs.writeFileSync(ACCESS_FILE, JSON.stringify(accessMap, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database_access.json:', err);
  }
}

// Helper to read database access mappings from disk or Supabase
async function readAccessMap(): Promise<Record<string, string[]>> {
  // 1. Try to read from Supabase if configured
  if (supabaseServerClient) {
    try {
      const { data, error } = await withTimeout(
        supabaseServerClient.from('database_access').select('*'),
        3000,
        'Supabase access list query timed out'
      );
      if (!error && data) {
        const map: Record<string, string[]> = {};
        data.forEach((row: any) => {
          const email = row.email.toLowerCase().trim();
          if (!map[email]) {
            map[email] = [];
          }
          if (!map[email].includes(row.db_id)) {
            map[email].push(row.db_id);
          }
        });
        // Cache to local file just in case
        writeAccessMapLocal(map);
        return map;
      } else {
        console.warn('Supabase access map read error, falling back to disk:', error);
      }
    } catch (err) {
      console.warn('Supabase access map read exception, falling back to disk:', err);
    }
  }

  // 2. Fall back to local file
  return readAccessMapLocal();
}

// Helper to write database access mappings (Dual local disk & Supabase)
async function writeAccessMap(accessMap: Record<string, string[]>): Promise<void> {
  // 1. ALWAYS write to local disk first
  writeAccessMapLocal(accessMap);

  // 2. Sync to Supabase if configured
  if (supabaseServerClient) {
    try {
      // Flatten map into rows: [ { email, db_id } ]
      const rows: { email: string; db_id: string }[] = [];
      Object.entries(accessMap).forEach(([email, dbIds]) => {
        const lowerEmail = email.toLowerCase().trim();
        dbIds.forEach((dbId) => {
          rows.push({ email: lowerEmail, db_id: dbId });
        });
      });

      // Clear all existing records and rewrite to guarantee sync
      await withTimeout(
        supabaseServerClient.from('database_access').delete().neq('email', 'placeholder_nonexistent_email@gmail.com'),
        3000,
        'Supabase access clear timed out'
      );

      if (rows.length > 0) {
        const { error } = await withTimeout(
          supabaseServerClient.from('database_access').insert(rows),
          3000,
          'Supabase access sync timed out'
        );
        if (error) {
          console.warn('Supabase access sync failed:', error);
        } else {
          console.log('Successfully synced database access map to Supabase.');
        }
      }
    } catch (err) {
      console.error('Error syncing database access map to Supabase:', err);
    }
  }
}

// Ensure the data directory exists lazily to prevent tracing errors in serverless environments
function ensureDataDirExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create DATA_DIR:', err);
  }
}

// Helper to read server databases from disk
function readServerDatabases(): any[] {
  try {
    ensureDataDirExists();
    if (!fs.existsSync(DB_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading server databases.json:', err);
    return [];
  }
}

// Helper to write server databases to disk
function writeServerDatabases(databases: any[]): void {
  try {
    ensureDataDirExists();
    fs.writeFileSync(DB_FILE, JSON.stringify(databases, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing server databases.json:', err);
  }
}

// Timeout helper for database operations to prevent hanging when offline or slow
function withTimeout<T = any>(promise: any, timeoutMs = 3500, errorMsg = 'Database operation timed out'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
    Promise.resolve(promise)
      .then((res: any) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Initialize Supabase Server Client dynamically if environment variables are set
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

let supabaseServerClient: any = null;
if (supabaseUrl && supabaseKey && isValidUrl(supabaseUrl)) {
  try {
    supabaseServerClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });
    console.log('Supabase Server Client successfully initialized with URL:', supabaseUrl);
  } catch (err) {
    console.error('Failed to initialize Supabase Server Client:', err);
  }
} else if (supabaseUrl || supabaseKey) {
  console.log('Supabase is partially configured but missing a valid HTTP/HTTPS URL or key.');
}

// Endpoint: Check Supabase configuration and schema status
app.get('/api/db/status', async (req, res) => {
  try {
    const isConfigured = !!supabaseServerClient;
    const sqlSetup = `-- Create the case_databases table
CREATE TABLE IF NOT EXISTS case_databases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  diaries JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Create the database_access table to store shared database permissions permanently
CREATE TABLE IF NOT EXISTS database_access (
  email TEXT NOT NULL,
  db_id TEXT NOT NULL,
  PRIMARY KEY (email, db_id)
);

-- Enable Row Level Security (RLS) on both tables
ALTER TABLE case_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_access ENABLE ROW LEVEL SECURITY;

-- Create policies for case_databases
CREATE POLICY "Allow select for user" ON case_databases FOR SELECT USING (true);
CREATE POLICY "Allow insert for user" ON case_databases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for user" ON case_databases FOR UPDATE USING (true);
CREATE POLICY "Allow delete for user" ON case_databases FOR DELETE USING (true);

-- Create policies for database_access
CREATE POLICY "Allow select for all" ON database_access FOR SELECT USING (true);
CREATE POLICY "Allow insert for all" ON database_access FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all" ON database_access FOR UPDATE USING (true);
CREATE POLICY "Allow delete for all" ON database_access FOR DELETE USING (true);
`;

    let connectionTest = false;
    let tableExists = false;
    let testError = '';

    if (supabaseServerClient) {
      try {
        // Simple light query to check if we can reach the database and if table exists
        const { data, error } = await withTimeout(
          supabaseServerClient
            .from('case_databases')
            .select('id')
            .limit(1),
          2500,
          'Supabase ping timed out'
        );

        if (!error) {
          connectionTest = true;
          tableExists = true;
        } else {
          connectionTest = true;
          testError = error.message;
          if (error.code === '42P01') {
            // Postgres undefined_table error code
            tableExists = false;
          }
        }
      } catch (err: any) {
        testError = err.message || String(err);
      }
    }

    return res.json({
      success: true,
      isConfigured,
      connectionTest,
      tableExists,
      testError,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : '',
      sqlSetup,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error checking status' });
  }
});

// Endpoint: List all databases for a specific user (Dual local disk & Supabase) with access control
app.get('/api/db/list', async (req, res) => {
  try {
    const { userId, email } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const userEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const isAdmin = userEmail === 'dhilipeee4211@gmail.com';
    const accessMap = await readAccessMap();
    const allowedDbIds = accessMap[userEmail] || [];

    // Filter local disk databases based on ownership/permissions
    let localDbs = readServerDatabases();
    if (!isAdmin) {
      localDbs = localDbs.filter((db: any) => db.userId === userId || allowedDbIds.includes(db.id));
    }

    if (!supabaseServerClient) {
      localDbs.sort((a: any, b: any) => b.createdAt - a.createdAt);
      return res.json({
        success: true,
        databases: localDbs,
        source: 'disk',
        error: null
      });
    }

    try {
      let data: any[] = [];
      if (isAdmin) {
        // Admin gets everything
        const { data: allData, error } = await withTimeout(
          supabaseServerClient.from('case_databases').select('*'),
          3500,
          'Supabase list query timed out'
        );
        if (error) throw error;
        if (allData) data = allData;
      } else {
        // Fetch own databases
        const ownRes = await withTimeout(
          supabaseServerClient.from('case_databases').select('*').eq('user_id', userId),
          3000,
          'Supabase own list query timed out'
        );
        if (ownRes.error) throw ownRes.error;
        if (ownRes.data) data.push(...ownRes.data);

        // Fetch shared databases
        if (allowedDbIds.length > 0) {
          const sharedRes = await withTimeout(
            supabaseServerClient.from('case_databases').select('*').in('id', allowedDbIds),
            3000,
            'Supabase shared list query timed out'
          );
          if (sharedRes.error) throw sharedRes.error;
          if (sharedRes.data) {
            // Avoid duplicate objects if some allowedDbId is also owned by the user
            sharedRes.data.forEach((item: any) => {
              if (!data.some((d: any) => d.id === item.id)) {
                data.push(item);
              }
            });
          }
        }
      }

      if (Array.isArray(data)) {
        const mappedDbs = data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          name: item.name,
          createdAt: Number(item.created_at),
          diaries: typeof item.diaries === 'string' ? JSON.parse(item.diaries) : item.diaries,
        }));

        const mergedMap = new Map();
        localDbs.forEach(db => mergedMap.set(db.id, db));
        mappedDbs.forEach(db => mergedMap.set(db.id, db));

        const finalDbs = Array.from(mergedMap.values());

        // Update local cache for this specific set
        const allLocalRest = readServerDatabases().filter((db: any) => {
          if (isAdmin) return false;
          return db.userId !== userId && !allowedDbIds.includes(db.id);
        });
        writeServerDatabases([...allLocalRest, ...finalDbs]);

        finalDbs.sort((a: any, b: any) => b.createdAt - a.createdAt);
        console.log(`Loaded ${finalDbs.length} databases (merged Supabase and local cache) for user ${userId} (${userEmail})`);

        return res.json({ success: true, databases: finalDbs, source: 'supabase_merged' });
      }

      localDbs.sort((a: any, b: any) => b.createdAt - a.createdAt);
      return res.json({ success: true, databases: localDbs, source: 'disk' });
    } catch (err: any) {
      console.log('Supabase fetch exception, falling back to disk:', err);
      localDbs.sort((a: any, b: any) => b.createdAt - a.createdAt);
      return res.json({ success: true, databases: localDbs, source: 'disk', error: err.message });
    }
  } catch (err) {
    console.error('Error in /api/db/list:', err);
    return res.status(500).json({ error: 'Failed to retrieve databases' });
  }
});

// Endpoint: Get a single database with its full diaries array (checking permissions)
app.get('/api/db/get', async (req, res) => {
  try {
    const { id, userId, email } = req.query;
    if (!id || !userId) {
      return res.status(400).json({ error: 'Missing id or userId parameter' });
    }

    const userEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const isAdmin = userEmail === 'dhilipeee4211@gmail.com';
    const accessMap = await readAccessMap();
    const allowedDbIds = accessMap[userEmail] || [];

    // Check if the user is allowed to access this database
    const isAllowed = isAdmin || allowedDbIds.includes(id as string);

    // Try finding in local disk first
    const allDbs = readServerDatabases();
    const diskDb = allDbs.find((db: any) => db.id === id);

    if (diskDb) {
      if (!isAllowed && diskDb.userId !== userId) {
        return res.status(403).json({ error: 'Access denied. You do not have permissions for this database.' });
      }
      return res.json({ success: true, database: diskDb, source: 'disk' });
    }

    if (!supabaseServerClient) {
      return res.status(404).json({ error: 'Database not found on local server.' });
    }

    // Try finding in Supabase
    try {
      const { data, error } = await withTimeout(
        supabaseServerClient
          .from('case_databases')
          .select('*')
          .eq('id', id)
          .single(),
        3500,
        'Supabase fetch database query timed out'
      );

      if (error) {
        throw error;
      }

      if (data) {
        if (!isAllowed && data.user_id !== userId) {
          return res.status(403).json({ error: 'Access denied. You do not have permissions for this database.' });
        }

        const mappedDb = {
          id: data.id,
          userId: data.user_id,
          name: data.name,
          createdAt: Number(data.created_at),
          diaries: typeof data.diaries === 'string' ? JSON.parse(data.diaries) : data.diaries,
        };

        // Cache locally on disk for future fast access
        const restDbs = allDbs.filter((db: any) => db.id !== mappedDb.id);
        restDbs.push(mappedDb);
        writeServerDatabases(restDbs);

        return res.json({ success: true, database: mappedDb, source: 'supabase' });
      }

      return res.status(404).json({ error: 'Database not found.' });
    } catch (supaErr: any) {
      console.log('Supabase single fetch error:', supaErr);
      return res.status(500).json({ error: 'Failed to retrieve database: ' + (supaErr.message || String(supaErr)) });
    }
  } catch (err: any) {
    console.error('Error in /api/db/get:', err);
    return res.status(500).json({ error: 'Failed to retrieve database' });
  }
});

// Endpoint: GET database access map (Admin only)
app.get('/api/db/access', async (req, res) => {
  const { email } = req.query;
  if (!email || email !== 'dhilipeee4211@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  const accessMap = await readAccessMap();
  return res.json({ success: true, accessMap });
});

// Endpoint: POST database access update (Admin only)
app.post('/api/db/access', async (req, res) => {
  const { requesterEmail, targetEmail, dbId, action } = req.body;

  if (!requesterEmail || requesterEmail !== 'dhilipeee4211@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  if (!targetEmail || !dbId || !action) {
    return res.status(400).json({ error: 'Missing parameters. Need targetEmail, dbId, and action.' });
  }

  const accessMap = await readAccessMap();
  const lowerTargetEmail = targetEmail.toLowerCase().trim();

  if (!accessMap[lowerTargetEmail]) {
    accessMap[lowerTargetEmail] = [];
  }

  if (action === 'grant') {
    if (!accessMap[lowerTargetEmail].includes(dbId)) {
      accessMap[lowerTargetEmail].push(dbId);
    }
  } else if (action === 'revoke') {
    accessMap[lowerTargetEmail] = accessMap[lowerTargetEmail].filter((id: string) => id !== dbId);
  } else {
    return res.status(400).json({ error: 'Invalid action. Use "grant" or "revoke".' });
  }

  await writeAccessMap(accessMap);
  return res.json({ success: true, accessMap });
});

// Endpoint: Save or update a database entry (Dual local disk & Supabase)
app.post('/api/db/save', async (req, res) => {
  try {
    const newDb = req.body;
    if (!newDb || !newDb.id || !newDb.userId || !newDb.name) {
      return res.status(400).json({ error: 'Invalid database payload. Missing id, userId, or name.' });
    }

    // ALWAYS write to local disk first!
    const allDbs = readServerDatabases();
    const restDbs = allDbs.filter((db: any) => db.id !== newDb.id);
    restDbs.push(newDb);
    writeServerDatabases(restDbs);
    console.log(`Successfully saved/synced database ${newDb.id} to server local disk.`);

    if (!supabaseServerClient) {
      return res.json({ success: true, database: newDb, supabaseSynced: false });
    }

    try {
      const { error } = await withTimeout(
        supabaseServerClient
          .from('case_databases')
          .upsert({
            id: newDb.id,
            user_id: newDb.userId,
            name: newDb.name,
            created_at: newDb.createdAt,
            diaries: newDb.diaries, // JSONB handles objects directly
          }, { onConflict: 'id' }),
        3500,
        'Supabase save query timed out'
      );

      if (error) {
        console.log('Supabase save error (saved to disk only):', error);
        return res.json({
          success: true,
          database: newDb,
          supabaseSynced: false,
          error: error.message
        });
      }
      console.log(`Successfully saved/synced database ${newDb.id} to Supabase.`);
      return res.json({ success: true, database: newDb, supabaseSynced: true });
    } catch (supaErr: any) {
      console.log('Supabase save exception (saved to disk only):', supaErr);
      return res.json({
        success: true,
        database: newDb,
        supabaseSynced: false,
        error: supaErr.message || String(supaErr)
      });
    }
  } catch (err: any) {
    console.error('Error in /api/db/save:', err);
    return res.status(500).json({ error: err.message || 'Server database save error' });
  }
});

// Endpoint: Delete a database entry (Dual local disk & Supabase)
app.post('/api/db/delete', async (req, res) => {
  try {
    const { id, userId, email } = req.body;
    if (!id || !userId) {
      return res.status(400).json({ error: 'Missing id or userId' });
    }

    // ALWAYS delete from local disk first!
    const allDbs = readServerDatabases();
    const updatedDbs = allDbs.filter((db: any) => db.id !== id);
    writeServerDatabases(updatedDbs);
    console.log(`Successfully deleted database ${id} from server local disk.`);

    // Clean up database access permissions for the deleted DB
    try {
      const accessMap = await readAccessMap();
      let accessModified = false;
      Object.keys(accessMap).forEach((userKey) => {
        if (accessMap[userKey] && accessMap[userKey].includes(id)) {
          accessMap[userKey] = accessMap[userKey].filter((dbId: string) => dbId !== id);
          accessModified = true;
        }
      });
      if (accessModified) {
        await writeAccessMap(accessMap);
        console.log(`Successfully cleaned up database access mapping for deleted database ${id}`);
      }
    } catch (accessErr) {
      console.error('Error cleaning up deleted database from access map:', accessErr);
    }

    if (!supabaseServerClient) {
      return res.json({ success: true, deleted: true, supabaseSynced: false });
    }

    const userEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const isAdmin = userEmail === 'dhilipeee4211@gmail.com';

    try {
      let query = supabaseServerClient.from('case_databases').delete().eq('id', id);
      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      const { error } = await withTimeout(
        query,
        3500,
        'Supabase delete query timed out'
      );

      if (error) {
        console.log('Supabase deletion error (deleted from disk):', error);
        return res.json({ success: true, deleted: true, supabaseSynced: false, error: error.message });
      }
      console.log(`Successfully deleted database ${id} from Supabase.`);
      return res.json({ success: true, deleted: true, supabaseSynced: true });
    } catch (supaErr: any) {
      console.log('Supabase deletion exception (deleted from disk):', supaErr);
      return res.json({ success: true, deleted: true, supabaseSynced: false, error: supaErr.message || String(supaErr) });
    }
  } catch (err: any) {
    console.error('Error in /api/db/delete:', err);
    return res.status(500).json({ error: err.message || 'Server database deletion error' });
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

// Export app for Vercel serverless handler (api/index.ts)
export default app;
