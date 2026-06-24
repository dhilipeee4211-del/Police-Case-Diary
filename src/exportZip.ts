import JSZip from "jszip";
import { generateCaseDiaryDocx } from "./exportDocx";
import { CaseDiary } from "./types";

/**
 * Compiles a list of CaseDiary records into a single .zip file containing Word documents.
 */
export async function exportDiariesToZip(diaries: CaseDiary[]): Promise<Blob> {
  const zip = new JSZip();
  
  for (let i = 0; i < diaries.length; i++) {
    const diary = diaries[i];
    const blob = await generateCaseDiaryDocx(diary);
    
    // Sanitize file name for Windows/macOS/Linux compatibility
    const rawNo = diary.crNoAndSecOfLaw || `Case_${i + 1}`;
    const safeName = rawNo.replace(/[\/\\?%*:|"<>]/g, "-").trim();
    const filename = `Case_Diary_${safeName}.docx`;
    
    zip.file(filename, blob);
  }
  
  return await zip.generateAsync({ type: "blob" });
}
