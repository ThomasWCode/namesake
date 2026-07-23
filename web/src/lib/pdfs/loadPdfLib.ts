/**
 * Dynamically import and load the PDF library.
 * @returns PDF library utilities
 */
export async function loadPdfLib() {
  const {
    PDF,
    PdfArray,
    PdfDict,
    PdfName,
    PdfNumber,
    PdfStream,
    StandardFonts,
  } = await import("@libpdf/core");

  return {
    PDF,
    PdfArray,
    PdfDict,
    PdfName,
    PdfNumber,
    PdfStream,
    StandardFonts,
  };
}
