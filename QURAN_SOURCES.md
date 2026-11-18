# Quran index provenance

The locally bundled surah index in `quran-data.js` is extracted from the official Tanzil Quran metadata XML, version 1.0.

- Author/copyright: Tanzil.info, (C) 2008–2009.
- Documentation: https://tanzil.net/docs/Quran_Metadata
- Original file: https://tanzil.net/res/text/metadata/quran-data.xml
- License identifier declared in the source XML: `cc-by`.
- Extracted fields: `index` -> `id`, `name` -> `name`, `ayas` -> `verses`.
- Extracted on 2026-11-19; Arabic names copied without editorial changes.
- Every ID/order and verse count was cross-checked against the official Quran.com chapter endpoint: https://api.quran.com/api/v4/chapters?language=ar
- All 114 IDs and verse counts match; Arabic names match after normalizing marks and alef variants. Total verses: 6,236.

The website uses only this local metadata snapshot. It makes no API request at runtime and includes no verse text, translations, recitation, or generated religious content. No copied reference image or third-party app branding is used in the Quran page.
