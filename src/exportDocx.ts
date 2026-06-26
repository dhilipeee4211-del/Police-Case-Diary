import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
} from "docx";
import { CaseDiary } from "./types";

/**
 * Creates the complete block of DOCX elements for a single Case Diary.
 *
 * LAYOUT STRATEGY (resolved overlapping and corruption issues):
 *   Instead of nesting tables which causes layout overlap and rendering bugs in MS Word,
 *   we use a sequential flat structure of borderless 2-column/4-column tables and standard
 *   paragraphs for headings/spacers. All borderless 2-column tables share the same column
 *   widths so they line up perfectly down the page.
 */

// Thin visible border — used ONLY for the Accused table grid
const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "999999",
};

// Invisible border — used for every other cell in the document
const noneBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF",
};
const noBorders = { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder };

// Master grid column widths (DXA). Total = 9000 (6.25in content width).
const LABEL_WIDTH = 3400;
const VALUE_WIDTH = 5600;
const FULL_WIDTH = LABEL_WIDTH + VALUE_WIDTH;

const boldText = (text: string, size = 10) =>
  new TextRun({ text, bold: true, size: size * 2, font: "Arial" });

const normalText = (text: string, size = 10) =>
  new TextRun({ text: (text === undefined || text === null) ? "NIL" : text, size: size * 2, font: "Arial" });

function cleanPoliceStation(ps: string): string {
  if (!ps) return "";
  let cleaned = ps.trim();
  cleaned = cleaned.replace(/\bPOLICE\s+STATION\b/gi, "");
  cleaned = cleaned.replace(/\bPS\b/gi, "");
  cleaned = cleaned.replace(/\bP\.S\.\b/gi, "");
  cleaned = cleaned.replace(/\bSTATION\b/gi, "");
  return cleaned.trim().toUpperCase();
}

function cleanPropertyDetail(val: string, stage: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  const upper = trimmed.toUpperCase();
  const stageUpper = (stage || "").trim().toUpperCase();
  
  if (upper === "NIL" || 
      upper === "NIL." || 
      upper === "NONE" || 
      upper === "NONE." || 
      upper === "NILL" || 
      upper === stageUpper || 
      upper === "PENDING TRIAL" || 
      upper === "CASE DISPOSED") {
    return "";
  }
  return trimmed;
}


/**
 * Splits a "CR. NO. & SEC. OF LAW" value like
 *   "0027/2022,  U/s 294(b),323,324,506(2) IPC"
 * into the CR number ("0027/2022") and the remaining section-of-law text
 * ("U/s 294(b),323,324,506(2) IPC").
 */
function splitCrNumber(value: string): { crNumber: string; rest: string } {
  const trimmed = (value || "").trim();
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx === -1) {
    return { crNumber: trimmed, rest: "" };
  }
  return {
    crNumber: trimmed.slice(0, commaIdx).trim(),
    rest: trimmed.slice(commaIdx + 1).trim(),
  };
}

const CASE_DISPOSED = "CASE DISPOSED";

/**
 * Standard master-grid row: LABEL cell (bold) | VALUE cell (plain).
 * Both cells are borderless and sit in the table column grid.
 */
function gridRow(label: string, value: string, opts?: { spaceBefore?: number; spaceAfter?: number }): TableRow {
  const before = opts?.spaceBefore ?? 60;
  const after = opts?.spaceAfter ?? 60;
  return new TableRow({
    children: [
      new TableCell({
        width: { size: LABEL_WIDTH, type: WidthType.DXA },
        borders: noBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            spacing: { before, after },
            children: [boldText(label)],
          }),
        ],
      }),
      new TableCell({
        width: { size: VALUE_WIDTH, type: WidthType.DXA },
        borders: noBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            spacing: { before, after },
            children: [normalText(value)],
          }),
        ],
      }),
    ],
  });
}

/**
 * Special row for "CR. NO. & SEC. OF LAW :" — when the case's stage is
 * "CASE DISPOSED", the CR number portion of the value is styled as a clear,
 * highlighted text badge to prevent document corruption.
 */
function crNoRow(label: string, value: string, stageOfTheCase: string, opts?: { spaceBefore?: number; spaceAfter?: number }): TableRow {
  const before = opts?.spaceBefore ?? 60;
  const after = opts?.spaceAfter ?? 60;
  const isDisposed = (stageOfTheCase || "").trim().toUpperCase() === CASE_DISPOSED;

  let valueChildren: any[];
  if (isDisposed) {
    const { crNumber, rest } = splitCrNumber(value);
    valueChildren = [
      new TextRun({
        text: `● DISPOSED ● ( ${crNumber || "NIL"} )`,
        bold: true,
        color: "DC2626", // Beautiful crimson/red text
        size: 22,
        font: "Arial",
      }),
      ...(rest ? [new TextRun({ text: "  ,  " + rest, size: 20, font: "Arial" })] : []),
    ];
  } else {
    valueChildren = [normalText(value)];
  }

  return new TableRow({
    children: [
      new TableCell({
        width: { size: LABEL_WIDTH, type: WidthType.DXA },
        borders: noBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            spacing: { before, after },
            children: [boldText(label)],
          }),
        ],
      }),
      new TableCell({
        width: { size: VALUE_WIDTH, type: WidthType.DXA },
        borders: noBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            spacing: { before, after },
            children: valueChildren,
          }),
        ],
      }),
    ],
  });
}

/**
 * A full-width row split into FOUR cells: label1 | value1 | label2 | value2.
 * Used for "POLICE STATION | DISTRICT" and "COURT REF. NO. | HEARING NO." style pairs.
 */
function gridPairRow(
  label1: string,
  value1: string,
  label2: string,
  value2: string,
  widths: [number, number, number, number] = [1900, 3000, 1500, 2600]
): TableRow {
  const [w1, w2, w3, w4] = widths;
  const cell = (width: number, runs: TextRun[]) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: noBorders,
      verticalAlign: VerticalAlign.TOP,
      children: [new Paragraph({ spacing: { before: 80, after: 80 }, children: runs })],
    });

  return new TableRow({
    children: [
      cell(w1, [boldText(label1)]),
      cell(w2, [normalText(value1)]),
      cell(w3, [boldText(label2)]),
      cell(w4, [normalText(value2)]),
    ],
  });
}

function createDiaryChildren(diary: CaseDiary): any[] {
  // ---- Nested Accused table (the ONLY visible-border table in the document) ----
  const accusedHeaders = new TableRow({
    children: [
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
        shading: { fill: "F3F4F6" },
        children: [
          new Paragraph({
            children: [boldText("S.NO.")],
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
          }),
        ],
      }),
      new TableCell({
        width: { size: 8000, type: WidthType.DXA },
        borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
        shading: { fill: "F3F4F6" },
        children: [
          new Paragraph({
            children: [boldText("NAME AND ADDRESS OF ACCUSED")],
            spacing: { before: 60, after: 60 },
          }),
        ],
      }),
    ],
  });

  const accusedRows = (diary.accusedList || []).map((acc) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 1000, type: WidthType.DXA },
          borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
          children: [
            new Paragraph({
              children: [normalText(acc.sNo)],
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
            }),
          ],
        }),
        new TableCell({
          width: { size: 8000, type: WidthType.DXA },
          borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
          children: [
            new Paragraph({
              children: [normalText(acc.nameAndAddress)],
              spacing: { before: 60, after: 60 },
            }),
          ],
        }),
      ],
    });
  });

  if (accusedRows.length === 0) {
    accusedRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9000, type: WidthType.DXA },
            columnSpan: 2,
            borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
            children: [
              new Paragraph({
                children: [normalText("No accused charged/listed")],
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
              }),
            ],
          }),
        ],
      })
    );
  }

  const accusedTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [1000, 8000],
    rows: [accusedHeaders, ...accusedRows],
  });

  // ---- Remarks: flowing paragraph(s) with **bold** inline marker support ----
  const parseInlineRuns = (line: string): TextRun[] => {
    const parts = line.split(/(\*\*.*?\*\*)/g).filter((p) => p.length > 0);
    if (parts.length === 0) return [normalText(line)];
    return parts.map((part) => {
      const boldMatch = part.match(/^\*\*(.*)\*\*$/);
      if (boldMatch) return boldText(boldMatch[1]);
      return normalText(part);
    });
  };

  const remarksText = diary.remarks || "NIL";
  const remarksParagraphs = remarksText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(
      (line) =>
        new Paragraph({
          children: parseInlineRuns(line),
          spacing: { before: 40, after: 40 },
        })
    );
  if (remarksParagraphs.length === 0) {
    remarksParagraphs.push(new Paragraph({ children: [normalText("NIL")], spacing: { before: 40, after: 40 } }));
  }

  // Helpers to create separate sequential borderless tables
  const create2ColTable = (rows: TableRow[]) => new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA },
    columnWidths: [LABEL_WIDTH, VALUE_WIDTH],
    borders: noBorders,
    rows,
  });

  const create4ColTable = (rows: TableRow[], widths: [number, number, number, number]) => new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders: noBorders,
    rows,
  });

  const createSectionHeader = (text: string) => new Paragraph({
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, size: 20, font: "Arial" })],
  });

  return [
    // ---- Header ----
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 },
      children: [new TextRun({ text: "TAMILNADU POLICE", bold: true, size: 28, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: "PT - CASE DIARY", bold: true, size: 22, font: "Arial" })],
    }),

    // Table 1: Police Station & District
    create4ColTable([
      gridPairRow("POLICE STATION  ", cleanPoliceStation(diary.policeStation), "DISTRICT ", diary.district, [1900, 3200, 1300, 2600])
    ], [1900, 3200, 1300, 2600]),

    new Paragraph({ spacing: { before: 40, after: 40 } }),

    // Table 2: Primary Metadata
    create2ColTable([
      crNoRow("CR. NO. & SEC. OF LAW :", diary.crNoAndSecOfLaw, diary.stageOfTheCase),
      gridRow("DATE, TIME & PLACE OF OCCURRENCE", diary.dateTimeAndPlaceOfOccurrence),
      gridRow("DATE OF CD", diary.dateOfCd),
      gridRow("I.DATE OF REPORT / TIME", diary.dateOfReportTime),
      gridRow("II.COMPLAINANT", diary.complainant),
    ]),

    // Section 3: Accused
    createSectionHeader("III.ACCUSED"),
    accusedTable,

    // Section 4: Property Lost
    createSectionHeader("IV.PROPERTY LOST DETAILS"),
    new Paragraph({
      children: [normalText(cleanPropertyDetail(diary.propertyLostDetails, diary.stageOfTheCase))],
      spacing: { before: 40, after: 80 },
      indent: { left: 200 },
    }),

    // Section 5: Recovered Property
    createSectionHeader("V.RECOVERED PROPERTY DETAILS"),
    new Paragraph({
      children: [normalText(cleanPropertyDetail(diary.recoveredPropertyDetails, diary.stageOfTheCase))],
      spacing: { before: 40, after: 80 },
      indent: { left: 200 },
    }),

    new Paragraph({ spacing: { before: 40, after: 40 } }),

    // Table 6: CD Dates & Case Stage
    create2ColTable([
      gridRow("VI.DATE OF PREVIOUS CASE DIARY", diary.dateOfPreviousCaseDiary),
      gridRow("VII.STAGE OF THE CASE", diary.stageOfTheCase),
    ]),

    new Paragraph({ spacing: { before: 40, after: 40 } }),

    // Table 7: Court Reference (4 columns)
    create4ColTable([
      gridPairRow("COURT REF. NO.  ", diary.courtRefNo, "HEARING NO.  ", diary.hearingNo, [1900, 2700, 1700, 2700])
    ], [1900, 2700, 1700, 2700]),

    new Paragraph({ spacing: { before: 40, after: 40 } }),

    // Table 8: Court Stats & Attendance
    create2ColTable([
      gridRow("COURT NAME AND PLACE", diary.courtNameAndPlace),
      gridRow("WHETHER MAGISTRATE PRESENT ?", diary.whetherMagistratePresent),
      gridRow("WHETHER APP / PP PRESENT ?", diary.whetherAppPpPresent),
      gridRow("WHETHER DEFENCE COUNSEL PRESENT ?", diary.whetherDefenceCounselPresent),
      gridRow("NO. OF PWs CITED", diary.noOfPwsCited),
      gridRow("NO.OF PWs EXAMINED SO FAR", diary.noOfPwsExaminedSoFar),
      gridRow("NO.OF PWs EXAMINED TODAY", diary.noOfPwsExaminedToday),
      gridRow("NO.OF ACCUSED CHARGED", diary.totalNoOfAccusedCharged),
      gridRow("TOTAL NO. OF ACCUSED PRESENT", diary.totalNoOfAccusedPresent),
      gridRow("NO. OF ACCUSED PRESENT", diary.noOfAccusedPresent),
      gridRow("NO. OF ACCUSED ABSENT", diary.noOfAccusedAbsent),
    ]),

    // Section 9: Remarks
    createSectionHeader("REMARKS"),
    ...remarksParagraphs,

    new Paragraph({ spacing: { before: 40, after: 40 } }),

    // Table 10: Hearing Details
    create2ColTable([
      gridRow("POSTED FOR", diary.postedFor),
      gridRow("NEXT HEARING DATE", diary.nextHearingDate),
      gridRow("ATTENDED BY", diary.attendedBy),
    ]),

    new Paragraph({ spacing: { before: 180, after: 180 } }),

    // SHO Signature
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 100, after: 40 },
      children: [new TextRun({ text: "Signature of SHO", bold: true, size: 20, font: "Arial" })],
    }),
  ];
}

/**
 * Generates a Microsoft Word document (.docx) matching the official Case Diary layout.
 */
export async function generateCaseDiaryDocx(diary: CaseDiary): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: createDiaryChildren(diary),
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Generates a single Microsoft Word document (.docx) combining multiple Case Diaries,
 * separated by standard Word section/page breaks.
 */
export async function generateMultipleCaseDiariesDocx(diaries: CaseDiary[]): Promise<Blob> {
  const doc = new Document({
    sections: diaries.map((diary) => ({
      properties: {},
      children: createDiaryChildren(diary),
    })),
  });

  return await Packer.toBlob(doc);
}
