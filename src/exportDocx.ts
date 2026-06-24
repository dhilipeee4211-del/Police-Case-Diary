/**
 * exportDocx.ts
 * Generates a PT Case Diary .docx that exactly matches the Tamil Nadu Police format
 * (derived from the uploaded PT_Case_Diary_CC89_2022.docx reference).
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
} from "docx";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccusedEntry {
  sNo: number;
  nameAndAddress: string;
}

export interface CaseDiary {
  policeStation: string;
  district: string;
  crNoAndSecOfLaw: string;
  dateTimePlace: string;        // e.g. "25-01-2022  08:00\nஅம்பாபூர் வாதி வீட்டின் அருகே"
  dateOfCd: string;
  dateOfReportTime: string;
  complainant: string;
  accused: AccusedEntry[];
  propertyLostDetails?: string;
  recoveredPropertyDetails?: string;
  datePreviousCaseDiary: string;
  stageOfCase: string;
  courtRefNo: string;
  hearingNo: string | number;
  courtNameAndPlace: string;
  magistratePresent: string;    // "YES" / "NO"
  appPpPresent: string;
  defenceCounselPresent: string;
  noPwsCited: string | number;
  noPwsExaminedSoFar: string | number;
  noPwsExaminedToday: string | number;
  noAccusedCharged: string | number;
  totalNoAccusedPresent: string | number;
  noAccusedPresent: string;
  noAccusedAbsent: string | number;
  remarks: string;              // may contain mixed Tamil/English
  postedFor: string;
  nextHearingDate: string;
  attendedBy: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const FONT = "Arial";
const SZ = 20;   // 10pt  (half-points)
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const THIN_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

function run(text: string, bold = false, sz = SZ): TextRun {
  return new TextRun({
    text,
    font: FONT,
    bold,
    size: sz,
  });
}

/** A label–value row in a borderless 2-column table (5233 + 5233 DXA) */
function infoRow(
  label: string,
  value: string,
  valueBold = false,
  spacingBefore = 80,
  spacingAfter = 80,
): TableRow {
  const cellProps = (content: Paragraph[]) =>
    new TableCell({
      width: { size: 5233, type: WidthType.DXA },
      borders: NO_BORDERS,
      children: content,
    });

  return new TableRow({
    children: [
      cellProps([
        new Paragraph({
          spacing: { before: spacingBefore, after: spacingAfter },
          children: [run(label, true)],
        }),
      ]),
      cellProps([
        new Paragraph({
          spacing: { before: spacingBefore, after: spacingAfter },
          children: [run(value, valueBold)],
        }),
      ]),
    ],
  });
}

/** Full-width borderless 2-col table */
function infoTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: 10466, type: WidthType.DXA },
    columnWidths: [5233, 5233],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      insideH: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      insideV: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
    },
    rows,
  });
}

/** Underline spacer paragraph (used for IV / V property sections) */
function underlineSpacer(spacingAfter = 80): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" } },
    spacing: { before: 0, after: spacingAfter },
    children: [run("")],
  });
}

// ── Main export function ───────────────────────────────────────────────────────

export async function generateCaseDiaryDocx(diary: CaseDiary): Promise<Blob> {
  // Split dateTimePlace on newline so date+time go on first line, place on second
  const [dateTimeLine, ...placeParts] = diary.dateTimePlace.split("\n");
  const placeLine = placeParts.join("\n");

  // ── Build accused table rows ────────────────────────────────────────────────
  const accusedHeaderRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 1200, type: WidthType.DXA },
        borders: THIN_BORDERS,
        shading: { fill: "D9D9D9", type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run("S.NO.", true)],
          }),
        ],
      }),
      new TableCell({
        width: { size: 9266, type: WidthType.DXA },
        borders: THIN_BORDERS,
        shading: { fill: "D9D9D9", type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run("NAME AND ADDRESS OF ACCUSED", true)],
          }),
        ],
      }),
    ],
  });

  const accusedDataRows = diary.accused.map(
    (a) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1200, type: WidthType.DXA },
            borders: THIN_BORDERS,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run(String(a.sNo))],
              }),
            ],
          }),
          new TableCell({
            width: { size: 9266, type: WidthType.DXA },
            borders: THIN_BORDERS,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [run(a.nameAndAddress)] })],
          }),
        ],
      }),
  );

  const accusedTable = new Table({
    width: { size: 10466, type: WidthType.DXA },
    columnWidths: [1200, 9266],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      insideH: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      insideV: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
    },
    rows: [accusedHeaderRow, ...accusedDataRows],
  });

  // ── Build COURT REF + HEARING NO row (two paras in right cell) ─────────────
  const courtRefRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 5233, type: WidthType.DXA },
        borders: NO_BORDERS,
        children: [
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [run(`COURT REF. NO.  ${diary.courtRefNo}`, true)],
          }),
        ],
      }),
      new TableCell({
        width: { size: 5233, type: WidthType.DXA },
        borders: NO_BORDERS,
        children: [
          new Paragraph({
            spacing: { before: 60, after: 0 },
            children: [run("HEARING NO.", true)],
          }),
          new Paragraph({
            spacing: { before: 0, after: 60 },
            children: [run(String(diary.hearingNo))],
          }),
        ],
      }),
    ],
  });

  // ── Page 1 children ─────────────────────────────────────────────────────────
  const page1Children = [
    // Header
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [run("TAMILNADU POLICE", true, 28)],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [run("PT - CASE DIARY", true, 32)],
    }),

    // Police Station + District (borderless, no outer box)
    new Table({
      width: { size: 10466, type: WidthType.DXA },
      columnWidths: [5233, 5233],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        insideH: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        insideV: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 5233, type: WidthType.DXA },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  children: [
                    run("POLICE STATION  ", true),
                    run(diary.policeStation),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 5233, type: WidthType.DXA },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  children: [
                    run("DISTRICT  ", true),
                    run(diary.district),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // CR No
    infoTable([infoRow("CR. NO. & SEC. OF LAW :", diary.crNoAndSecOfLaw)]),

    // Date/Time/Place — right cell has two paras
    new Table({
      width: { size: 10466, type: WidthType.DXA },
      columnWidths: [5233, 5233],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        insideH: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        insideV: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 5233, type: WidthType.DXA },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 80 },
                  children: [run("DATE, TIME & PLACE OF OCCURRENCE", true)],
                }),
              ],
            }),
            new TableCell({
              width: { size: 5233, type: WidthType.DXA },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 40 },
                  children: [run(dateTimeLine)],
                }),
                ...(placeLine
                  ? [
                      new Paragraph({
                        spacing: { before: 0, after: 80 },
                        children: [run(placeLine)],
                      }),
                    ]
                  : []),
              ],
            }),
          ],
        }),
      ],
    }),

    infoTable([infoRow("DATE OF CD", diary.dateOfCd)]),
    infoTable([infoRow("I.DATE OF REPORT / TIME", diary.dateOfReportTime)]),
    infoTable([infoRow("II.COMPLAINANT", diary.complainant)]),

    // III. ACCUSED heading
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [run("III.ACCUSED", true)],
    }),

    accusedTable,

    // IV. Property Lost
    new Paragraph({
      spacing: { before: 120, after: 40 },
      children: [run("IV.PROPERTY LOST DETAILS", true)],
    }),
    underlineSpacer(80),

    // V. Recovered Property
    new Paragraph({
      spacing: { before: 120, after: 40 },
      children: [run("V.RECOVERED PROPERTY DETAILS", true)],
    }),
    underlineSpacer(160),

    // VI onwards — big info table
    infoTable([
      infoRow("VI.DATE OF PREVIOUS CASE DIARY", diary.datePreviousCaseDiary, false, 60, 60),
      infoRow("VII.STAGE OF THE CASE", diary.stageOfCase, false, 60, 60),
      courtRefRow,
      infoRow("COURT NAME AND PLACE", diary.courtNameAndPlace, false, 60, 60),
      infoRow("WHETHER MAGISTRATE PRESENT ?", diary.magistratePresent, false, 60, 60),
      infoRow("WHETHER APP / PP PRESENT ?", diary.appPpPresent, false, 60, 60),
      infoRow("WHETHER DEFENCE COUNSEL PRESENT ?", diary.defenceCounselPresent, false, 60, 60),
      infoRow("NO. OF PWs CITED", String(diary.noPwsCited), false, 60, 60),
      infoRow("NO.OF PWs EXAMINED SO FAR", String(diary.noPwsExaminedSoFar), false, 60, 60),
      infoRow("NO.OF PWs EXAMINED TODAY", String(diary.noPwsExaminedToday), false, 60, 60),
      infoRow("NO.OF ACCUSED CHARGED", String(diary.noAccusedCharged), false, 60, 60),
      infoRow("TOTAL NO. OF ACCUSED PRESENT", String(diary.totalNoAccusedPresent), false, 60, 60),
      infoRow("NO. OF ACCUSED PRESENT", diary.noAccusedPresent, false, 60, 60),
      infoRow("NO. OF ACCUSED ABSENT", String(diary.noAccusedAbsent), false, 60, 60),
    ]),
  ];

  // ── Page 2 children ─────────────────────────────────────────────────────────
  // Parse remarks into TextRun segments (handles **bold** markers for Dedicated Bench etc.)
  const remarksRuns = parseRemarksToRuns(diary.remarks);

  const page2Children = [
    // REMARKS heading — page break before
    new Paragraph({
      pageBreakBefore: true,
      spacing: { before: 0, after: 120 },
      children: [run("REMARKS", true, 22)],
    }),

    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: remarksRuns,
    }),

    infoTable([
      infoRow("POSTED FOR", diary.postedFor, false, 80, 80),
      infoRow("NEXT HEARING DATE", diary.nextHearingDate, false, 80, 80),
      infoRow("ATTENDED BY", diary.attendedBy, false, 80, 80),
    ]),

    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 800, after: 80 },
      children: [run("Signature of SHO", true)],
    }),
  ];

  // ── Assemble document ───────────────────────────────────────────────────────
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 portrait
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [...page1Children, ...page2Children],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ── Remarks parser (handles mixed Tamil/English + inline **bold**) ─────────────
function parseRemarksToRuns(text: string): TextRun[] {
  // Split on **...**  to identify bold segments
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return run(part.slice(2, -2), true);
    }
    return run(part, false);
  });
}
