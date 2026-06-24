import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  // Set CORS and parse options
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { file, filename } = req.body || {};

    if (!file) {
      return res.status(400).json({ error: 'No file data provided in the payload.' });
    }

    const name = filename || 'document.pdf';
    if (!name.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are supported.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY environment variable is not configured. Please define it in your Vercel Project Settings.',
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
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                data: file,
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

        extractedData = JSON.parse(responseText.trim());
        break; 
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!extractedData) {
      throw new Error(
        lastError?.message || 'All attempted Gemini models returned errors or were unavailable.'
      );
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, data: extractedData });
  } catch (error: any) {
    console.error('Extraction handler error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      error: 'Failed to extract document contents: ' + (error.message || ''),
    });
  }
}
