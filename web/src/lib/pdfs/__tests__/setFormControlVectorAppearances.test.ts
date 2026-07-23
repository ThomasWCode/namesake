import {
  type PDFForm,
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
} from "@libpdf/core";
import { describe, expect, it, vi } from "vitest";
import { setFormControlVectorAppearances } from "../setFormControlVectorAppearances";

const pdfLib = {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
};
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

/** Create a minimal off-state appearance used by the mocked form widgets. */
function createOffAppearance(content = "0.75 g\n0 0 10 10 re\nS\n") {
  const appearance = PdfStream.fromDict({
    Type: PdfName.of("XObject"),
    Subtype: PdfName.of("Form"),
    FormType: PdfNumber.of(1),
    BBox: PdfArray.of(
      PdfNumber.of(0),
      PdfNumber.of(0),
      PdfNumber.of(10),
      PdfNumber.of(10),
    ),
    Resources: new PdfDict(),
  });
  appearance.setData(textEncoder.encode(content));
  return appearance;
}

describe("setFormControlVectorAppearances", () => {
  it("replaces every checkbox on-state while preserving its off-state appearance", () => {
    const firstOffAppearance = createOffAppearance();
    const secondOffAppearance = createOffAppearance();
    const firstSetNormalAppearance = vi.fn();
    const secondSetNormalAppearance = vi.fn();
    const checkbox = {
      getWidgets: () => [
        {
          width: 10,
          height: 10,
          getOnValue: () => "First",
          getNormalAppearance: (state?: string) =>
            state === "Off" ? firstOffAppearance : null,
          setNormalAppearance: firstSetNormalAppearance,
        },
        {
          width: 10,
          height: 10,
          getOnValue: () => "Second",
          getNormalAppearance: (state?: string) =>
            state === "Off" ? secondOffAppearance : null,
          setNormalAppearance: secondSetNormalAppearance,
        },
      ],
    };
    const form = {
      getCheckbox: (name: string) =>
        name === "choices" ? checkbox : undefined,
      getRadioGroup: () => undefined,
    } as unknown as PDFForm;

    setFormControlVectorAppearances({
      form,
      fieldNames: ["choices", "listbox"],
      pdfLib,
    });

    expect(firstSetNormalAppearance).toHaveBeenCalledOnce();
    expect(secondSetNormalAppearance).toHaveBeenCalledOnce();
    expect(firstSetNormalAppearance).toHaveBeenCalledWith(
      expect.any(PdfStream),
      "First",
    );
    expect(secondSetNormalAppearance).toHaveBeenCalledWith(
      expect.any(PdfStream),
      "Second",
    );

    const [appearance] = firstSetNormalAppearance.mock.calls[0] as [
      PdfStream,
      string,
    ];
    const content = textDecoder.decode(appearance.getDecodedData());
    const vectorContent = content.slice(content.lastIndexOf("\nq\n"));

    // The original box remains, followed by two renderer-independent line paths.
    expect(content).toContain("0.75 g\n0 0 10 10 re\nS");
    expect(vectorContent.match(/\nS\n/g)).toHaveLength(2);
    expect(content).not.toMatch(/\/ZaDb|\bBT\b|\bTj\b/);
  });

  it("creates a complete fallback appearance when the off-state is missing", () => {
    const setNormalAppearance = vi.fn();
    const radio = {
      getWidgets: () => [
        {
          width: 8,
          height: 12,
          getOnValue: () => "Option",
          getNormalAppearance: () => null,
          setNormalAppearance,
        },
      ],
    };
    const form = {
      getCheckbox: () => undefined,
      getRadioGroup: (name: string) =>
        name === "selection" ? radio : undefined,
    } as unknown as PDFForm;

    setFormControlVectorAppearances({
      form,
      fieldNames: ["selection"],
      pdfLib,
    });

    const [appearance, state] = setNormalAppearance.mock.calls[0] as [
      PdfStream,
      string,
    ];
    expect(state).toBe("Option");
    expect(appearance.getName("Type")?.value).toBe("XObject");
    expect(appearance.getName("Subtype")?.value).toBe("Form");
    const boundingBox = appearance.getArray("BBox");
    expect(
      Array.from({ length: 4 }, (_, index) => {
        const coordinate = boundingBox?.at(index);
        expect(coordinate).toBeInstanceOf(PdfNumber);
        return (coordinate as PdfNumber).value;
      }),
    ).toEqual([0, 0, 8, 12]);
    expect(textDecoder.decode(appearance.getDecodedData())).not.toMatch(
      /\/ZaDb|\bBT\b|\bTj\b/,
    );
  });
});
