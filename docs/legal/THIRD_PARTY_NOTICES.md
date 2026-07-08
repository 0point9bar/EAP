# Third-Party Notices

EAP ships under the MIT License. It has **no third-party runtime dependencies**
and **no Elastic-License (ELv2) source** (see the context-mode clean-room note
in [`ATTRIBUTION.md`](ATTRIBUTION.md)). The following upstream projects are
MIT-licensed; where EAP includes substantial portions of their **documentation
or code**, their copyright and permission notices are retained verbatim below.

## ponytail — EAP-Lean rule text and skills

EAP-Lean's rule file (`layers/eap-lean/EAP-LEAN.md`) and its three skills
(`eap-lean-review`, `eap-lean-audit`, `eap-lean-debt`) are derivative of
ponytail's documentation (its decision ladder, tag vocabulary, scoring strings,
worked examples, and safety carve-outs). This is a documentation derivative, not
concept-only; ponytail is MIT, and its notice is retained here.

- Project: `ponytail` — Author: DietrichGebert — https://github.com/DietrichGebert/ponytail

```
MIT License

Copyright (c) 2026 DietrichGebert

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## caveman — via EAP-Signal (through TLDR)

EAP-Signal descends from TLDR, whose installer/skill machinery is in turn
caveman-derived (MIT). Where that lineage carries substantial portions,
caveman's notice is retained here.

- Project: `caveman` — Author: Julius Brussee — https://github.com/JuliusBrussee/caveman

```
MIT License

Copyright (c) 2026 Julius Brussee

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## graphify — EAP-Context vocabulary and one helper

EAP-Context uses **no** graphify source at scale, but does inherit the
`_trigrams` helper shape, the `EXTRACTED`/`INFERRED` provenance tokens, and the
"god node" vocabulary. graphify is MIT (© 2026 Safi Shamsi,
https://github.com/Graphify-Labs/graphify); its notice is retained for those
items. No graphify dependencies are used.
