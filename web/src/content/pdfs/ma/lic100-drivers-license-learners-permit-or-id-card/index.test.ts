import { PDF } from "@libpdf/core";
import { describe, expect, it } from "vitest";
import type { FormData } from "#constants/fields";
import { expectPdfFieldsMatch } from "#lib/pdfs/expectPdfFieldsMatch";
import { fillPdf } from "#lib/pdfs/fillPdf";
import licenseAndIdApplication from ".";

describe("LIC100 Driver's License, Learner's Permit, or ID Card Application", () => {
  const testData: Partial<FormData> = {
    stateIdType: "realId",
    stateIdDocumentType: "driversLicense",
    driversLicenseClass: "passenger",
    newFirstName: "Marsha",
    newMiddleName: "P",
    newLastName: "Johnson",
    nameSuffix: "Jr.",
    oldFirstName: "Old",
    oldMiddleName: "M",
    oldLastName: "Name",
    currentMassachusettsCredentialNumber: "S12345678",
    dateOfBirth: "1990-01-01",
    shouldChangeAddress: false,
    shouldChangeDateOfBirth: false,
    shouldChangeGenderMarker: true,
    shouldChangeHeight: false,
    shouldChangeEyeColor: false,
    residenceStreetAddress: "123 Main St",
    residenceStreetAddress2: "Apt 4",
    residenceCity: "Boston",
    residenceState: "MA",
    residenceZipCode: "02108",
    isMailingAddressDifferentFromResidence: true,
    mailingStreetAddress: "456 Post St",
    mailingStreetAddress2: "Unit 2",
    mailingCity: "Cambridge",
    mailingState: "MA",
    mailingZipCode: "02139",
    email: "test@example.com",
    phoneType: "cell",
    phoneNumber: "+1 (617) 555-0123",
    hasEmergencyContact: true,
    emergencyContactEmail: "contact@example.com",
    emergencyContactName: "Sylvia Rivera",
    emergencyContactPhoneType: "home",
    emergencyContactPhoneNumber: "+1 (617) 555-0456",
    newGender: "X",
    eyeColor: "Brown",
    heightFeet: "5",
    heightInches: "8",
    isOrganDonor: true,
    isActiveDutyMilitary: false,
    isVeteran: true,
    shouldAddVeteranDesignation: true,
    militaryBranch: "Army",
    isUSCitizen: true,
    hasOtherJurisdictionCredential: true,
    otherCredentialJurisdiction: "Rhode Island",
    otherCredentialClass: "D",
    otherCredentialNumber: "1234567",
    currentOtherCredentials: "Rhode Island ID 7654321",
    hasDrivingImpairment: false,
    takesDrivingMedication: false,
    hasSuspendedLicense: false,
    consentProviderType: "parent",
    guardianFullName: "Parent Name",
    guardianAddress: "789 Family St, Boston, MA 02108",
  };

  it("maps all fields correctly to the PDF", async () => {
    await expectPdfFieldsMatch(licenseAndIdApplication, testData);
  });

  it("leaves unanswered radio fields blank", async () => {
    const incompleteData: Partial<FormData> = {
      newGender: [] as unknown as FormData["newGender"],
      eyeColor: [] as unknown as FormData["eyeColor"],
    };

    const fields = licenseAndIdApplication.resolver(incompleteData);
    expect(fields.Gender).toBeUndefined();
    expect(fields["Eye Color"]).toBeUndefined();
    await expect(
      fillPdf({ pdf: licenseAndIdApplication, userData: incompleteData }),
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it("uses font-independent vector appearances after filling and merging", async () => {
    const filledBytes = await fillPdf({
      pdf: licenseAndIdApplication,
      userData: testData,
    });
    const mergedPdf = await PDF.merge([filledBytes]);
    const mergedBytes = await mergedPdf.save();
    const reloadedPdf = await PDF.load(mergedBytes);
    const form = reloadedPdf.getForm();

    expect(form).not.toBeNull();

    // Check both checkbox and radio groups, including unselected options.
    const controlNames = [
      "Type",
      "Document to Issue",
      "Service Type",
      "Name",
      "Gender change",
      "Gender",
    ];
    for (const name of controlNames) {
      const field = form?.getCheckbox(name) ?? form?.getRadioGroup(name);
      expect(field, `Expected form control "${name}"`).toBeDefined();

      for (const widget of field?.getWidgets() ?? []) {
        const onValue = widget.getOnValue();
        expect(onValue, `Expected an on-state for "${name}"`).toBeTruthy();

        const appearance = widget.getNormalAppearance(onValue ?? undefined);
        expect(
          appearance,
          `Expected an on-state appearance for "${name}"`,
        ).not.toBeNull();

        const content = new TextDecoder().decode(appearance?.getDecodedData());
        const vectorContent = content.slice(content.lastIndexOf("\nq\n"));

        // A LibPDF upgrade must not reintroduce font glyphs into LIC100 marks.
        expect(vectorContent).not.toMatch(/\/ZaDb|\bBT\b|\bTj\b/);
        expect(vectorContent.match(/\nS\n/g)).toHaveLength(2);
      }
    }
  });
});
