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
  HeadingLevel, 
  VerticalAlign 
} from "docx";
import { CaseDiary } from "./types";

/**
 * Creates the complete block of DOCX elements (paragraphs, tables, spacing) for a single Case Diary.
 * Formatted exactly like the uploaded PDF layout with ONLY the accused details in a visible table.
 * All other fields are clean, unboxed borderless sections.
 */
function createDiaryChildren(diary: CaseDiary): any[] {
  // Thin border style for the Accused table grid
  const thinBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "CCCCCC",
  };

  // None border style for removing borders from other alignment grids
  const noneBorder = {
    style: BorderStyle.NONE,
  };

  const boldText = (text: string, size = 10) => new TextRun({ text, bold: true, size: size * 2, font: "Arial" });
  const normalText = (text: string, size = 10) => new TextRun({ text: text || "NIL", size: size * 2, font: "Arial" });

  // Borderless Table row builder with "round up" / boxed border for CR. NO. field
  const borderlessRow = (label: string, value: string, space = 60) => {
    const isCrNo = label.toUpperCase().includes("CR. NO.") || label.toUpperCase().includes("CR.NO.");
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 3800, type: WidthType.DXA },
          borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
          children: [new Paragraph({ children: [boldText(label)], spacing: { before: space, after: space } })],
        }),
        new TableCell({
          width: { size: 5200, type: WidthType.DXA },
          borders: isCrNo 
            ? { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
            : { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
          shading: isCrNo ? { fill: "F9FAFB" } : undefined,
          children: [
            new Paragraph({ 
              children: [
                isCrNo 
                  ? new TextRun({ text: `  ${value}  `, bold: true, size: 22, font: "Arial", color: "111827" })
                  : normalText(value)
              ], 
              spacing: { before: isCrNo ? 80 : space, after: isCrNo ? 80 : space } 
            })
          ],
        }),
      ],
    });
  };

  // Build Accused List table rows
  const accusedHeaders = new TableRow({
    children: [
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
        shading: { fill: "F3F4F6" },
        children: [new Paragraph({ children: [boldText("S.NO.")], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })],
      }),
      new TableCell({
        width: { size: 8000, type: WidthType.DXA },
        borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
        shading: { fill: "F3F4F6" },
        children: [new Paragraph({ children: [boldText("NAME AND ADDRESS OF ACCUSED")], spacing: { before: 60, after: 60 } })],
      }),
    ],
  });

  const accusedRows = (diary.accusedList || []).map((acc) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 1000, type: WidthType.DXA },
          borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
          children: [new Paragraph({ children: [normalText(acc.sNo)], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })],
        }),
        new TableCell({
          width: { size: 8000, type: WidthType.DXA },
          borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
          children: [new Paragraph({ children: [normalText(acc.nameAndAddress)], spacing: { before: 60, after: 60 } })],
        }),
      ],
    });
  });

  // If accused list is empty, add a placeholder row
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
                spacing: { before: 60, after: 60 } 
              })
            ],
          }),
        ],
      })
    );
  }

  return [
    // Header Title Centered
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 },
      children: [
        new TextRun({
          text: "TAMILNADU POLICE",
          bold: true,
          size: 28, // 14pt
          font: "Arial",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: "PT - CASE DIARY",
          bold: true,
          size: 22, // 11pt
          font: "Arial",
        }),
      ],
    }),

    // POLICE STATION & DISTRICT (Side-by-side borderless table)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [2200, 2300, 1800, 2700],
      borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
              children: [new Paragraph({ children: [boldText("POLICE STATION  ")], spacing: { before: 80, after: 80 } })],
            }),
            new TableCell({
              width: { size: 2300, type: WidthType.DXA },
              borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
              children: [new Paragraph({ children: [normalText(diary.policeStation)], spacing: { before: 80, after: 80 } })],
            }),
            new TableCell({
              width: { size: 1800, type: WidthType.DXA },
              borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
              children: [new Paragraph({ children: [boldText("DISTRICT ")], spacing: { before: 80, after: 80 } })],
            }),
            new TableCell({
              width: { size: 2700, type: WidthType.DXA },
              borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
              children: [new Paragraph({ children: [normalText(diary.district)], spacing: { before: 80, after: 80 } })],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 120, after: 60 } }),

    // Primary Metadata (Borderless table)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3800, 5200],
      borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
      rows: [
        borderlessRow("CR. NO. & SEC. OF LAW :", diary.crNoAndSecOfLaw),
        borderlessRow("DATE, TIME & PLACE OF OCCURRENCE", diary.dateTimeAndPlaceOfOccurrence),
        borderlessRow("DATE OF CD", diary.dateOfCd),
        borderlessRow("I. DATE OF REPORT / TIME", diary.dateOfReportTime),
        borderlessRow("II. COMPLAINANT", diary.complainant),
      ],
    }),

    new Paragraph({ spacing: { before: 180, after: 60 } }),

    // III. ACCUSED (Simple Heading)
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: "III. ACCUSED", bold: true, size: 20, font: "Arial" })],
    }),

    // Accused Table (The ONLY visual grid table in the entire layout)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [1000, 8000],
      rows: [accusedHeaders, ...accusedRows],
    }),

    new Paragraph({ spacing: { before: 180, after: 60 } }),

    // IV. PROPERTY LOST DETAILS
    new Paragraph({
      children: [new TextRun({ text: "IV. PROPERTY LOST DETAILS", bold: true, size: 20, font: "Arial" })],
      spacing: { before: 120, after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: diary.propertyLostDetails || "NIL", size: 20, font: "Arial" })],
      spacing: { before: 40, after: 120 },
      indent: { left: 360 },
    }),

    // V. RECOVERED PROPERTY DETAILS
    new Paragraph({
      children: [new TextRun({ text: "V. RECOVERED PROPERTY DETAILS", bold: true, size: 20, font: "Arial" })],
      spacing: { before: 120, after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: diary.recoveredPropertyDetails || "NIL", size: 20, font: "Arial" })],
      spacing: { before: 40, after: 120 },
      indent: { left: 360 },
    }),

    new Paragraph({ spacing: { before: 120, after: 60 } }),

    // Secondary Metadata (Borderless table)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3800, 5200],
      borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
      rows: [
        borderlessRow("VI. DATE OF PREVIOUS CASE DIARY", diary.dateOfPreviousCaseDiary),
        borderlessRow("VII. STAGE OF THE CASE", diary.stageOfTheCase),
      ],
    }),

    new Paragraph({ spacing: { before: 120, after: 60 } }),

    // COURT REF. NO. & HEARING NO. (Side-by-side)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [2200, 2300, 1800, 2700],
      borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
              children: [new Paragraph({ children: [boldText("COURT REF. NO. ")], spacing: { before: 80, after: 80 } })],
            }),
            new TableCell({
              width: { size: 2300, type: WidthType.DXA },
              borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
              children: [new Paragraph({ children: [normalText(diary.courtRefNo)], spacing: { before: 80, after: 80 } })],
            }),
            new TableCell({
              width: { size: 1800, type: WidthType.DXA },
              borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
              children: [new Paragraph({ children: [boldText("HEARING NO. ")], spacing: { before: 80, after: 80 } })],
            }),
            new TableCell({
              width: { size: 2700, type: WidthType.DXA },
              borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
              children: [new Paragraph({ children: [normalText(diary.hearingNo)], spacing: { before: 80, after: 80 } })],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 120, after: 60 } }),

    // Court Stats & Attendance (Borderless table)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3800, 5200],
      borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
      rows: [
        borderlessRow("COURT NAME AND PLACE", diary.courtNameAndPlace),
        borderlessRow("WHETHER MAGISTRATE PRESENT ?", diary.whetherMagistratePresent),
        borderlessRow("WHETHER APP / PP PRESENT ?", diary.whetherAppPpPresent),
        borderlessRow("WHETHER DEFENCE COUNSEL PRESENT ?", diary.whetherDefenceCounselPresent),
        borderlessRow("NO. OF PWs CITED", diary.noOfPwsCited),
        borderlessRow("NO. OF PWs EXAMINED SO FAR", diary.noOfPwsExaminedSoFar),
        borderlessRow("NO. OF PWs EXAMINED TODAY", diary.noOfPwsExaminedToday),
        borderlessRow("TOTAL NO. OF ACCUSED CHARGED", diary.totalNoOfAccusedCharged),
        borderlessRow("NO. OF ACCUSED PRESENT", diary.noOfAccusedPresent),
        borderlessRow("NO. OF ACCUSED ABSENT", diary.noOfAccusedAbsent),
      ],
    }),

    new Paragraph({ spacing: { before: 200, after: 60 } }),

    // REMARKS Section (Preserves exact line breaks for Tamil voice typing and typewriter copies)
    new Paragraph({
      children: [new TextRun({ text: "REMARKS", bold: true, size: 22, font: "Arial" })],
      spacing: { before: 180, after: 80 },
    }),
    ...((diary.remarks || "NIL").split("\n").map((line) => {
      return new Paragraph({
        children: [new TextRun({ text: line || " ", size: 20, font: "Arial" })],
        spacing: { before: 40, after: 40 },
        indent: { left: 240 },
      });
    })),

    new Paragraph({ spacing: { before: 120, after: 60 } }),

    // Posted / Next Hearing (Borderless table)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3800, 5200],
      borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
      rows: [
        borderlessRow("POSTED FOR", diary.postedFor),
        borderlessRow("NEXT HEARING DATE", diary.nextHearingDate),
        borderlessRow("ATTENDED BY", diary.attendedBy),
      ],
    }),

    new Paragraph({ spacing: { before: 360, after: 120 } }),

    // SHO Signature box right-aligned exactly like original PDF scan
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 300, after: 40 },
      children: [
        new TextRun({
          text: "Signature of SHO",
          bold: true,
          size: 20,
          font: "Arial",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: "________________________",
          size: 20,
          font: "Arial",
        }),
      ],
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
 * separated by standard Word page breaks.
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
