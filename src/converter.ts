/**
 * Core Google Drive and Google Docs file operations for PDF to Word conversion.
 */

/**
 * Uploads a PDF file to Google Drive and requests conversion to a Google Doc.
 * The Google Drive API's automatic conversion is highly accurate at preserving layouts, tables, and typography.
 */
export async function uploadAndConvertPdf(accessToken: string, file: File): Promise<string> {
  const metadata = {
    name: file.name.replace(/\.pdf$/i, '') + ' (Converted Word Source)',
    mimeType: 'application/vnd.google-apps.document', // This converts the PDF to a Google Doc
  };

  const boundary = '-------314159265358979323846';
  const firstDelimiter = `--${boundary}\r\n`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Read file as ArrayBuffer
  const reader = new FileReader();
  const fileDataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read PDF file content'));
  });
  reader.readAsArrayBuffer(file);
  const fileData = await fileDataPromise;

  const metadataPart = JSON.stringify(metadata);
  
  // Construct a multipart body combining JSON metadata and binary file data
  const multipartBody = new Blob([
    firstDelimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadataPart,
    delimiter,
    'Content-Type: application/pdf\r\n\r\n',
    fileData,
    closeDelimiter
  ]);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload and conversion failed: ${response.status} ${response.statusText}. details: ${errText}`);
  }

  const result = await response.json();
  if (!result.id) {
    throw new Error('Google Drive API returned an invalid upload response with no file ID.');
  }

  return result.id;
}

/**
 * Exports a Google Doc (ID) as a Microsoft Word (.docx) file.
 */
export async function exportToDocx(accessToken: string, fileId: string): Promise<Blob> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to export document as Word: ${response.status} ${response.statusText}. details: ${errText}`);
  }

  return await response.blob();
}

/**
 * Deletes a file from Google Drive (e.g. to clean up the temporary conversion file).
 */
export async function deleteFileFromDrive(accessToken: string, fileId: string): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete temporary file: ${response.status} ${response.statusText}. details: ${errText}`);
  }
}
