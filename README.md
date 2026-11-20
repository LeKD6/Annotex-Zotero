# Annotex for Zotero

Local, editable reading notes with links back to saved evidence, plus a writing packet containing HTML notes, a JSON source map and BibTeX. Optional AI uses your own cloud API key. No Annotex account, subscription or hosted backend is required.

This is a public beta, tested on macOS with Zotero 10.0.9. Other platforms and Zotero versions have not been verified. It has a separate plugin identity from the older hosted Annotex plugin and uses GitHub for updates.

## Install and start

1. Use the supplied `annotex-open-0.4.0rc8.xpi`. You do not need Node.js, a model, or an account to install it. Developers building from the source archive can instead run `npm run build` with Node.js 18+ and macOS zip.
2. In Zotero, open Tools → Plugins, then the gear menu → Install Plugin From File. Choose `dist/annotex-open-0.4.0rc8.xpi`. Restart Zotero if requested. Subsequent updates are served from GitHub.
3. Select a paper and click **Open reading note**. The first click creates an editable Zotero note with links to the highlights and comments you had saved at the time. Opening it again preserves your writing. Existing notes from earlier versions stay in your library.
4. Choose **Export notes and bibliography…** to save the paper’s reading notes, current highlights and references. To export several papers, select them in the library and use **Tools → Annotex: Export notes and bibliography…**.
5. For help with a passage, select text in the PDF and choose **Define** or **Explain**. For a summary of saved material, choose **Summarize highlights and notes with AI**. Results are saved separately from your reading note.

The template separates the author's argument, evidence/method, your interpretation, connections/limits and possible writing uses. It covers saved excerpts and notes, not an automatic full-paper reading. Printed page labels and physical PDF page indexes are distinct. Passage links use the actual annotation key. Local Zotero links require the same items to exist in the opening library; exporting a packet does not distribute the PDF or make these links portable to strangers.

Human comments are not replaced by AI explanations. Comments and ordinary child notes are included as evidence; generated notes are excluded from recursively becoming source material. AI and uncertain legacy comments retain labels. Tag an annotation or ordinary note `annotex:exclude` to omit it from evidence collection. Review exports before sharing because your research notes and source excerpts are included intentionally.

## Optional AI

Reading notes and writing packets need no AI, key or Annotex account. AI is off by default, including after upgrading from a candidate with local AI. There is no local model, custom URL or automatic provider fallback.

In the Annotex Open item panel, expand **AI settings**. Choose **OpenAI** or **Claude (Anthropic)**, enter that service’s exact chat model ID and your own API key, check **Enable AI and send requests when I click**, then save. Use a direct provider model ID and a key from that provider’s API account. Old gateway settings are disabled, not transferred. Your own provider account pays for requests. Saving settings sends nothing. Claude uses the native Anthropic Messages API. Annotex sets the request options for the selected provider.

Keys last for the Zotero session unless you explicitly remember a new key in the profile credential store. Blank keeps a key only for the selected service. **Forget saved keys and turn off AI** removes keys (including earlier remembered endpoints). Protect profile backups; removing a key here does not revoke it at the provider.

Once you enable this setting, each click sends the request directly to your selected provider without another prompt. Earlier versions’ AI setting does not carry over, so enable it once after updating. Saved provider settings and remembered keys stay in place. Explanations send the selection and document title; synthesis sends the reading’s saved excerpts, ordinary notes, source identifiers and page labels. Earlier AI comments and comments of uncertain authorship are excluded. No PDF or full library upload, redirects, automatic retry or Annotex telemetry. The service and its model provider can process and bill for the text. Their policies, and your normal Zotero sync settings for saved notes, still apply. Exclusions do not remove material from older snapshots or packets.

AI output is saved separately and labeled unreviewed. Treat it as a draft. Check every attributed claim and source link against the original. Requests time out after 30 seconds with no automatic retry. A timeout does not prove that the provider did not process or bill the request. Error bodies are not shown or logged. Configured credentials are kept outside notes/exports and redacted if echoed in model text; do not paste secrets into research content yourself.

## Tests and license

`npm run check` runs syntax, packaging, provider-protocol, reading-workflow and mocked-registration checks. Tests use synthetic fixtures and dummy credentials, with no paid inference. Native testing requires a separate Zotero profile **and** separate data directory. Unit tests alone do not establish native compatibility or model quality. See `test-fixtures/reading-workflow.pdf` for the redistributable synthetic passage.

The cloud request tests use a simulated transport, not a paid model. Native results are recorded separately in the release review. Real cloud inference, provider retention, the native folder picker, other operating systems and other Zotero versions are not verified by these tests.

Open `demo/index.html` for a one-minute walkthrough generated from that native packet. It traces a synthetic draft claim to a saved excerpt and the included original PDF. This is an HTML walkthrough, not a video or model-quality benchmark. Build archives use fixed timestamps and sorted file lists for reproducible packaging on the tested macOS toolchain.

MIT license. See `THIRD_PARTY_NOTICES.md`. Zotero and installed bibliography translators are separate software with their own licenses. The original hosted Annotex app is not part of this source package. Nothing in this candidate migrates accounts, billing or hosted documents.

## Publishing updates

Build with `npm run build` and publish the versioned XPI and `SHA256SUMS` in GitHub Releases. Verify that the public asset can be downloaded and matches the checksum, then update `updates.json` on `main` with its exact version, asset URL, SHA-256 hash and Zotero compatibility range. Keep the feed URL and the add-on ID stable. Updates for the standalone plugin do not affect the legacy hosted plugin.
