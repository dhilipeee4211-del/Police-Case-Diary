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
 */
function createDiaryChildren(diary: CaseDiary): any[] {
  // Thin border style for table grids
  const thinBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "CCCCCC",
  };

  const boldText = (text: string, size = 11) => new TextRun({ text, bold: true, size: size * 2, font: "Arial" });
  const normalText = (text: string, size = 11) => new TextRun({ text: text || "N/A", size: size * 2, font: "Arial" });

  const labelValueRow = (label: string, value: string, labelWidth = 3150, valueWidth = 5850) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: labelWidth, type: WidthType.DXA },
          borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [boldText(label)], spacing: { before: 80, after: 80 } })],
        }),
        new TableCell({
          width: { size: valueWidth, type: WidthType.DXA },
          borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [normalText(value)], spacing: { before: 80, after: 80 } })],
        }),
      ],
    });
  };

  // Build Accused List table rows
  const accusedHeaders = new TableRow({
    children: [
      new TableCell({
        width: { size: 1350, type: WidthType.DXA },
        borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
        shading: { fill: "F3F4F6" },
        children: [new Paragraph({ children: [boldText("S.NO.")], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })],
      }),
      new TableCell({
        width: { size: 7650, type: WidthType.DXA },
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
          width: { size: 1350, type: WidthType.DXA },
          borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
          children: [new Paragraph({ children: [normalText(acc.sNo)], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })],
        }),
        new TableCell({
          width: { size: 7650, type: WidthType.DXA },
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
    // TAMILNADU POLICE Emblem Placeholder / Header Text
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "TAMILNADU POLICE",
          bold: true,
          size: 32, // 16pt
          font: "Arial",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: "PT - CASE DIARY",
          bold: true,
          size: 26, // 13pt
          font: "Arial",
        }),
      ],
    }),

    // Station & District Layout block (horizontal table)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [4500, 4500],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4500, type: WidthType.DXA },
              borders: { bottom: thinBorder },
              children: [
                new Paragraph({
                  children: [boldText("POLICE STATION:  "), normalText(diary.policeStation)],
                  spacing: { before: 100, after: 100 },
                }),
              ],
            }),
            new TableCell({
              width: { size: 4500, type: WidthType.DXA },
              borders: { bottom: thinBorder },
              children: [
                new Paragraph({
                  children: [boldText("DISTRICT:  "), normalText(diary.district)],
                  spacing: { before: 100, after: 100 },
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 180 } }),

    // Parameter List Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3150, 5850],
      rows: [
        labelValueRow("CR. NO. & SEC. OF LAW", diary.crNoAndSecOfLaw),
        labelValueRow("DATE, TIME & PLACE OF OCCURRENCE", diary.dateTimeAndPlaceOfOccurrence),
        labelValueRow("DATE OF CD", diary.dateOfCd),
        labelValueRow("DATE OF REPORT / TIME", diary.dateOfReportTime),
        labelValueRow("II. COMPLAINANT", diary.complainant),
      ],
    }),

    new Paragraph({ spacing: { before: 180 } }),

    // Accused header
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: "III. ACCUSED DETAILS", bold: true, size: 24, font: "Arial" })],
    }),

    // Accused Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [1350, 7650],
      rows: [accusedHeaders, ...accusedRows],
    }),

    new Paragraph({ spacing: { before: 180 } }),

    // Recovered & Property Parameters Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3150, 5850],
      rows: [
        labelValueRow("IV. PROPERTY LOST DETAILS", diary.propertyLostDetails || "NIL"),
        labelValueRow("V. RECOVERED PROPERTY DETAILS", diary.recoveredPropertyDetails || "NIL"),
        labelValueRow("VI. DATE OF PREVIOUS CASE DIARY", diary.dateOfPreviousCaseDiary),
        labelValueRow("VII. STAGE OF THE CASE", diary.stageOfTheCase),
        labelValueRow("COURT REF. NO.", diary.courtRefNo),
        labelValueRow("HEARING NO.", diary.hearingNo),
        labelValueRow("COURT NAME AND PLACE", diary.courtNameAndPlace),
      ],
    }),

    new Paragraph({ spacing: { before: 180 } }),

    // Secondary stats parameters grid
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3150, 5850],
      rows: [
        labelValueRow("WHETHER MAGISTRATE PRESENT?", diary.whetherMagistratePresent),
        labelValueRow("WHETHER APP / PP PRESENT?", diary.whetherAppPpPresent),
        labelValueRow("WHETHER DEFENCE COUNSEL PRESENT?", diary.whetherDefenceCounselPresent),
        labelValueRow("NO. OF PWs CITED", diary.noOfPwsCited),
        labelValueRow("NO. OF PWs EXAMINED SO FAR", diary.noOfPwsExaminedSoFar),
        labelValueRow("NO. OF PWs EXAMINED TODAY", diary.noOfPwsExaminedToday),
        labelValueRow("TOTAL NO. OF ACCUSED CHARGED", diary.totalNoOfAccusedCharged),
        labelValueRow("NO. OF ACCUSED PRESENT", diary.noOfAccusedPresent),
        labelValueRow("NO. OF ACCUSED ABSENT", diary.noOfAccusedAbsent),
      ],
    }),

    new Paragraph({ spacing: { before: 240 } }),

    // REMARKS Section with styled box
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: "REMARKS", bold: true, size: 24, font: "Arial" })],
    }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [9000],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 9000, type: WidthType.DXA },
              borders: { bottom: thinBorder, right: thinBorder, top: thinBorder, left: thinBorder },
              shading: { fill: "FAFAFA" },
              children: [
                new Paragraph({
                  children: [normalText(diary.remarks || "No remarks logged.")],
                  spacing: { before: 140, after: 140 },
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 180 } }),

    // Posted / Hearing Information Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3150, 5850],
      rows: [
        labelValueRow("POSTED FOR", diary.postedFor),
        labelValueRow("NEXT HEARING DATE", diary.nextHearingDate),
        labelValueRow("ATTENDED BY", diary.attendedBy),
      ],
    }),

    new Paragraph({ spacing: { before: 480 } }),

    // SHO Signature box right-aligned
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 360, after: 60 },
      children: [
        new TextRun({
          text: "Signature of SHO",
          bold: true,
          size: 24,
          font: "Arial",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: "________________________",
          size: 24,
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
