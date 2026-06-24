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
 * LAYOUT STRATEGY (matches the uploaded PDF exactly):
 *   The ENTIRE form is ONE master table with a fixed LABEL column and a fixed VALUE
 *   column, so every label and every value lines up perfectly down the page —
 *   just like the scanned PDF form. All borders on this master table are invisible.
 *   The ONLY visible grid lines in the whole document are on the nested
 *   "Accused" table (S.NO. / NAME AND ADDRESS OF ACCUSED), exactly like the source.
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
  new TextRun({ text: text || "NIL", size: size * 2, font: "Arial" });

/**
 * Standard master-grid row: LABEL cell (bold) | VALUE cell (plain).
 * Both cells are borderless and sit in the document's single shared column grid,
 * so every row's label/value boundary lines up vertically with every other row.
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
 * A full-width row split into FOUR cells: label1 | value1 | label2 | value2.
 * Used for "POLICE STATION | DISTRICT" and "COURT REF. NO. | HEARING NO." style
 * pairs. Giving each piece its own properly-sized cell (rather than cramming
 * "label + value" text into one narrow LABEL_WIDTH cell) keeps every value on
 * the SAME line as its label — no more wrapping to the next line.
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

/**
 * Helper to build a 2-column borderless table.
 */
function twoColumnBorderlessTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA },
    columnWidths: [LABEL_WIDTH, VALUE_WIDTH],
    borders: noBorders,
    rows,
  });
}

/**
 * Helper to build section headers with a clean bottom border line, matching the scan.
 */
function sectionHeaderWithBorder(text: string): Table {
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: FULL_WIDTH, type: WidthType.DXA },
            borders: { top: noneBorder, bottom: thinBorder, left: noneBorder, right: noneBorder },
            children: [
              new Paragraph({
                children: [boldText(text)],
                spacing: { before: 120, after: 60 },
              }),
            ],
          }),
        ],
      }),
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
          indent: { left: 200 },
        })
    );
  if (remarksParagraphs.length === 0) {
    remarksParagraphs.push(new Paragraph({ children: [normalText("NIL")], spacing: { before: 40, after: 40 }, indent: { left: 200 } }));
  }

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

    // POLICE STATION / DISTRICT (no nesting)
    new Table({
      width: { size: FULL_WIDTH, type: WidthType.DXA },
      borders: noBorders,
      rows: [
        gridPairRow("POLICE STATION  ", diary.policeStation, "DISTRICT ", diary.district, [1900, 3200, 1300, 2600]),
      ],
    }),

    new Paragraph({ spacing: { before: 100, after: 0 } }),

    // Primary metadata (no nesting)
    twoColumnBorderlessTable([
      gridRow("CR. NO. & SEC. OF LAW :", diary.crNoAndSecOfLaw),
      gridRow("DATE, TIME & PLACE OF OCCURRENCE", diary.dateTimeAndPlaceOfOccurrence),
      gridRow("DATE OF CD", diary.dateOfCd),
      gridRow("I.DATE OF REPORT / TIME", diary.dateOfReportTime),
      gridRow("II.COMPLAINANT", diary.complainant),
    ]),

    new Paragraph({ spacing: { before: 140, after: 0 } }),

    // III. ACCUSED — Heading
    new Paragraph({
      spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: "III.ACCUSED", bold: true, size: 20, font: "Arial" })],
    }),

    // Accused Table (no nesting)
    accusedTable,

    new Paragraph({ spacing: { before: 140, after: 0 } }),

    // IV. PROPERTY LOST DETAILS Header & Line
    sectionHeaderWithBorder("IV.PROPERTY LOST DETAILS"),
    
    // IV. PROPERTY LOST DETAILS Value (Indented)
    new Paragraph({
      children: [normalText(diary.propertyLostDetails || "NIL")],
      spacing: { before: 60, after: 120 },
      indent: { left: 200 },
    }),

    // V. RECOVERED PROPERTY DETAILS Header & Line
    sectionHeaderWithBorder("V.RECOVERED PROPERTY DETAILS"),

    // V. RECOVERED PROPERTY DETAILS Value (Indented)
    new Paragraph({
      children: [normalText(diary.recoveredPropertyDetails || "NIL")],
      spacing: { before: 60, after: 120 },
      indent: { left: 200 },
    }),

    new Paragraph({ spacing: { before: 100, after: 0 } }),

    // VI / VII Table (no nesting)
    twoColumnBorderlessTable([
      gridRow("VI.DATE OF PREVIOUS CASE DIARY", diary.dateOfPreviousCaseDiary),
      gridRow("VII.STAGE OF THE CASE", diary.stageOfTheCase),
    ]),

    new Paragraph({ spacing: { before: 100, after: 0 } }),

    // COURT REF. NO. / HEARING NO. Table (no nesting)
    new Table({
      width: { size: FULL_WIDTH, type: WidthType.DXA },
      borders: noBorders,
      rows: [
        gridPairRow("COURT REF. NO.  ", diary.courtRefNo, "HEARING NO.  ", diary.hearingNo, [1900, 2700, 1700, 2700]),
      ],
    }),

    new Paragraph({ spacing: { before: 100, after: 0 } }),

    // Court stats & attendance Table (no nesting)
    twoColumnBorderlessTable([
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

    new Paragraph({ spacing: { before: 160, after: 0 } }),

    // REMARKS Heading
    new Paragraph({
      spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: "REMARKS", bold: true, size: 20, font: "Arial" })],
    }),

    // Remarks content paragraphs (no nesting)
    ...remarksParagraphs,

    new Paragraph({ spacing: { before: 100, after: 0 } }),

    // Posted / Next Hearing / Attended By Table (no nesting)
    twoColumnBorderlessTable([
      gridRow("POSTED FOR", diary.postedFor),
      gridRow("NEXT HEARING DATE", diary.nextHearingDate),
      gridRow("ATTENDED BY", diary.attendedBy),
    ]),

    new Paragraph({ spacing: { before: 280, after: 0 } }),

    // SHO Signature — right aligned, full width
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