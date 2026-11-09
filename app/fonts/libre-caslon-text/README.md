# Libre Caslon Text

Unmodified variable font files (normal and italic), weight range 400–700.
Source: https://github.com/google/fonts/tree/main/ofl/librecaslontext
License: SIL Open Font License 1.1; see OFL.txt.
Loaded locally with next/font/local; no runtime Google Fonts requests.

The `.woff2` files are lossless webfont encodings of the supplied `.ttf` files,
generated with FontTools `TTFont`, setting `flavor = "woff2"`. All glyphs,
character mappings, variable axes, normal/italic faces, and 400–700 weights are
preserved. The original TTFs remain here for provenance; only WOFF2 is served.

`libre-caslon-text-400-static.ttf` and `libre-caslon-text-600-static.ttf` are static
instances of the variable TTF (FontTools `varLib.instancer`, `wght` 400 and 600), used
only by the club link-preview card renderer (`lib/club-share-card.tsx`), which cannot
read variable fonts. Same OFL 1.1 licence; the family has no Reserved Font Name.
