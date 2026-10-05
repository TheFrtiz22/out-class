# Student profile and documents

The canonical profile overview presents a responsive 96–128px avatar, name, academics, résumé and LinkedIn. Bio and ACT subsections are absent from presentation; historical `StudentProfile.bio` and ACT subsection columns remain unchanged. Overall ACT remains visible. Structured experience remains editable through its existing dialog and available in other configured workflows. The overview no longer duplicates résumé content with Experience or Campus involvement sections.

`lib/student-profile.ts` supplies shared section validation, URL normalization, file validation and a four-item optional completion checklist. Domain URLs receive `https://`; explicit HTTP/HTTPS is preserved. Credentials, unsupported schemes and malformed domains are rejected. LinkedIn must have a LinkedIn hostname. Internal résumé storage keys stay keys and must belong to the authenticated owner when saved.

`actions/profile.ts` updates only the selected section. `actions/storage.ts` validates uploaded bytes and MIME before issuing an owner-scoped signed upload, then uses the Supabase SDK. PDFs accept PDF/generic/empty MIME with a PDF signature (10MB limit); photos accept JPEG/PNG/WebP signatures (5MB limit). Next server-action body limit is 12MB to accommodate multipart PDF requests. Photo URLs use the existing headshots bucket public-URL mechanism; that bucket must be configured accordingly. Private résumé storage must be configured as private, with a service key for the bucket check. Save attaches the reference; cancelling may leave an unattached uploaded object.

Private profile résumés open through `/api/resumes`, which verifies current ownership or identified, non-anonymous reviewer access before issuing a short-lived signed read. Application attachments use the same validated upload transport but remain separate answers and open through `/api/application-attachments` with its own application/question authorization. User-provided external document links open directly; importing a link does not parse its content.

Interview and voting use the shared `ApplicantDisplayPanel` and server projection. Avatars are 96–112px with the existing Radix fallback for missing/loading/broken images. Presentation settings never grant identity access. Bio is removed from legacy display configurations on read. ACT exposes composite only. When résumé is configured, structured experience is suppressed from that presentation; it remains available when selected without résumé.

Demo Mode uses local deterministic sample headshot and PDF assets, normalized fictional LinkedIn links and its isolated store. Uploads remain disabled in Demo Mode; reset restores sample references without production writes. Attachment storage requires no schema migration; PDF import adds the parser dependency described below. Hosted storage delivery and actual account uploads require configured Supabase services and are not established by mocked local tests.

## PDF résumé import

The Profile page offers “Import PDF into profile” separately from storing a résumé attachment.
`prepareResumeImport` authenticates, validates a PDF (10 MiB maximum), extracts text in a terminable Node worker, validates a conservative proposal, then stores the document through the existing private upload boundary. It does not write profile data.

PDF.js 6.4.299 requires Node 22.13 or later. Extraction is limited to 10 pages, 60,000 characters, eight seconds and a worker V8 heap budget; at most two parser workers run per application process. This is text extraction, not OCR. Native/external allocations are not fully bounded by V8 resource limits. Scanned, encrypted, malformed and oversized documents produce controlled errors.

Review values are ephemeral. All replacements and experience additions start unchecked. Confirmation revalidates an owner-scoped payload, checks selected scalar baselines and updates the profile in one serializable transaction. Selected experiences append; case-insensitive exact title/organization/period duplicates are skipped. Existing experience IDs, bio, photos, links and unselected values remain. Students may separately select attachment replacement.

Mapping covers names, explicitly labeled major/graduation/GPA/SAT/ACT and recognizable experience headings with title/organization/period entries. Ambiguous suggestions are labeled; unsupported or unrecognized information is not silently imported. Skills, richer degrees/education, biography and campus involvement are not new profile categories. LinkedIn and URL importing are absent. Demo Mode disables PDF imports without calling production actions.

Cancel leaves the profile unchanged, but privately uploaded documents are retained, matching existing attachment uploads; no object cleanup/history mechanism was added. Parser/UI/action tests use fictional fixtures. Hosted deployment must package the PDF.js modules and native optional dependencies through Next tracing; no production smoke test is implied by local validation.
