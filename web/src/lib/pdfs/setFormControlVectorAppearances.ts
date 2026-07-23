import type { PDFForm, PdfStream } from "@libpdf/core";

type CheckboxField = NonNullable<ReturnType<PDFForm["getCheckbox"]>>;
type FormControlWidget = ReturnType<CheckboxField["getWidgets"]>[number];
type VectorAppearancePdfLib = Pick<
  typeof import("@libpdf/core"),
  "PdfArray" | "PdfDict" | "PdfName" | "PdfNumber" | "PdfStream"
>;

const textEncoder = new TextEncoder();

/** Join an existing appearance stream with the vector mark without decoding it as text. */
function concatenateBytes(first: Uint8Array, second: Uint8Array) {
  const result = new Uint8Array(first.length + second.length);
  result.set(first);
  result.set(second, first.length);
  return result;
}

/** Keep generated PDF numbers compact and avoid exponential notation. */
function formatNumber(value: number) {
  return String(Number(value.toFixed(4)));
}

/** Create an on-state appearance that preserves the off-state box and adds a vector X. */
function createVectorAppearance(
  widget: FormControlWidget,
  pdfLib: VectorAppearancePdfLib,
): PdfStream {
  const { PdfArray, PdfDict, PdfName, PdfNumber, PdfStream } = pdfLib;
  const offAppearance = widget.getNormalAppearance("Off");
  const existingContent = offAppearance?.getDecodedData() ?? new Uint8Array();

  // Clone the off-state appearance so LIC100 keeps its original box and border.
  const appearance =
    offAppearance == null
      ? PdfStream.fromDict({
          Type: PdfName.of("XObject"),
          Subtype: PdfName.of("Form"),
          FormType: PdfNumber.of(1),
          BBox: PdfArray.of(
            PdfNumber.of(0),
            PdfNumber.of(0),
            PdfNumber.of(widget.width),
            PdfNumber.of(widget.height),
          ),
          Resources: new PdfDict(),
        })
      : new PdfStream(offAppearance);

  const size = Math.min(widget.width, widget.height);
  const inset = size * 0.23;
  const left = inset;
  const right = widget.width - inset;
  const bottom = inset;
  const top = widget.height - inset;
  const lineWidth = Math.max(size * 0.13, 0.6);

  // PDF path operators are renderer-independent and do not require a font.
  const vectorMark = textEncoder.encode(
    [
      "",
      "q",
      "0 G",
      `${formatNumber(lineWidth)} w`,
      "1 J",
      "1 j",
      `${formatNumber(left)} ${formatNumber(bottom)} m`,
      `${formatNumber(right)} ${formatNumber(top)} l`,
      "S",
      `${formatNumber(left)} ${formatNumber(top)} m`,
      `${formatNumber(right)} ${formatNumber(bottom)} l`,
      "S",
      "Q",
      "",
    ].join("\n"),
  );

  appearance.setData(concatenateBytes(existingContent, vectorMark));
  return appearance;
}

/**
 * Replace checkbox and radio on-state appearances with portable vector marks.
 * Every option is updated so controls remain usable if someone changes the PDF later.
 */
export function setFormControlVectorAppearances({
  form,
  fieldNames,
  pdfLib,
}: {
  form: PDFForm;
  fieldNames: Iterable<string>;
  pdfLib: VectorAppearancePdfLib;
}) {
  for (const name of new Set(fieldNames)) {
    const field = form.getCheckbox(name) ?? form.getRadioGroup(name);
    if (!field) continue;

    for (const widget of field.getWidgets()) {
      const onValue = widget.getOnValue();
      if (!onValue || onValue === "Off") continue;

      widget.setNormalAppearance(
        createVectorAppearance(widget, pdfLib),
        onValue,
      );
    }
  }
}
