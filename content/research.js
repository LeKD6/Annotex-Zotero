/* global Zotero, ChromeUtils */
// Local reading evidence stays in Zotero. No model or cloud account is needed
// to create a reading note or export a writing packet.
var AnnotexResearch = {
  NOTE_TAG: "annotex:reading-note",
  AI_TAG: "annotex:ai",
  REVIEW_TAG: "annotex:reviewed",
  SNAPSHOT_PREFIX: "annotex:source:",

  escape(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  },

  tags(item) { return (item?.getTags?.() || []).map(tag => tag.tag); },
  hasTag(item, tag) { return this.tags(item).includes(tag); },
  isGenerated(item) {
    const heading = (item?.getNote?.() || "").replace(/<[^>]*>/g, " ").trim().replace(/\s+/g, " ");
    return this.hasTag(item, this.AI_TAG) || this.hasTag(item, this.NOTE_TAG)
      || /^Annotex (?:summary|selected-note synthesis|research note|Definition|Explanation|Define|Explain|Intuition|Deep dive)/i.test(heading);
  },

  parent(item) {
    return item?.parentID ? Zotero.Items.get(item.parentID) : item;
  },

  // IDs used in generated text are supplied by Zotero, never invented by AI.
  itemLink(item) {
    const library = Zotero.Libraries.get(item.libraryID);
    const path = library.libraryType === "group"
      ? `groups/${library.groupID || Zotero.Groups.getGroupIDFromLibraryID(item.libraryID)}`
      : "library";
    return `zotero://select/${path}/items/${encodeURIComponent(item.key)}`;
  },

  annotationLink(attachment, annotationKey, pageIndex) {
    const library = Zotero.Libraries.get(attachment.libraryID);
    const path = library.libraryType === "group"
      ? `groups/${library.groupID || Zotero.Groups.getGroupIDFromLibraryID(attachment.libraryID)}`
      : "library";
    const query = [];
    if (Number.isInteger(pageIndex) && pageIndex >= 0) query.push(`page=${pageIndex + 1}`);
    if (annotationKey) query.push(`annotation=${encodeURIComponent(annotationKey)}`);
    return `zotero://open-pdf/${path}/items/${encodeURIComponent(attachment.key)}${query.length ? `?${query.join("&")}` : ""}`;
  },

  plainText(html) {
    const win = Zotero.getMainWindow();
    const doc = new win.DOMParser().parseFromString(String(html || ""), "text/html");
    for (const element of doc.querySelectorAll("script, style")) element.remove();
    for (const element of doc.querySelectorAll("br")) element.replaceWith("\n");
    for (const element of doc.querySelectorAll("p, div, li, h1, h2, h3, blockquote, tr")) element.append("\n");
    return doc.body.textContent.replace(/\n{3,}/g, "\n\n").trim();
  },

  citation(item) {
    const creators = (item.getCreators?.() || []).map(c => c.name || [c.firstName, c.lastName].filter(Boolean).join(" "));
    return {
      title: item.getField("title") || "Untitled reading",
      authors: creators,
      date: item.getField("date") || "",
      publication: item.getField("publicationTitle") || item.getField("bookTitle") || "",
      DOI: item.getField("DOI") || "",
      url: item.getField("url") || "",
      itemKey: item.key,
      libraryID: item.libraryID,
      zoteroURI: Zotero.URI.getItemURI(item),
      link: this.itemLink(item)
    };
  },

  async collect(item) {
    const parent = this.parent(item);
    if (!parent || parent.isNote?.() || !parent.key) throw new Error("Select a reading or its PDF attachment.");
    // A paper note covers all PDFs belonging to that bibliographic item.
    const attachments = parent.isPDFAttachment?.() ? [parent]
      : (parent.getAttachments?.() || []).map(id => Zotero.Items.get(id)).filter(a => a?.isPDFAttachment?.());
    const sources = [];
    for (const attachment of attachments) {
      for (const annotation of attachment.getAnnotations()) {
        if (annotation.deleted || this.hasTag(annotation, "annotex:exclude")) continue;
        const text = annotation.annotationText || "";
        const comment = annotation.annotationComment || "";
        if (!text.trim() && !comment.trim()) continue;
        let position = {};
        try { position = JSON.parse(annotation.annotationPosition || "{}"); } catch (_) { /* Unknown stays unknown. */ }
        const taggedAI = this.hasTag(annotation, this.AI_TAG);
        const aiHash = `annotex:ai-hash:${Zotero.Utilities.Internal.md5(comment)}`;
        const ai = taggedAI && this.hasTag(annotation, aiHash);
        const legacyAI = !ai && (taggedAI || /^Annotex (?:Definition|Explanation|Define|Explain|Intuition|Deep dive)\s*\n/.test(comment));
        sources.push({
          id: `${attachment.libraryID}:${attachment.key}:${annotation.key}`,
          kind: "annotation", libraryID: attachment.libraryID, itemKey: parent.key,
          attachmentKey: attachment.key, annotationKey: annotation.key,
          pageLabel: annotation.annotationPageLabel || "",
          pageIndex: Number.isInteger(position.pageIndex) ? position.pageIndex : null,
          excerpt: text, humanNote: ai || legacyAI ? "" : comment,
          aiNote: ai ? comment : "", uncertainNote: legacyAI ? comment : "",
          origin: ai ? "ai" : legacyAI ? "uncertain-legacy" : "source-and-user-note",
          link: this.annotationLink(attachment, annotation.key, position.pageIndex)
        });
      }
    }
    for (const id of parent.getNotes?.() || []) {
      const note = Zotero.Items.get(id);
      if (!note || note.deleted || this.isGenerated(note) || this.hasTag(note, "annotex:exclude")) continue;
      const text = this.plainText(note.getNote());
      if (text) sources.push({
        id: `${note.libraryID}:note:${note.key}`, kind: "note", libraryID: note.libraryID,
        itemKey: parent.key, noteKey: note.key, pageLabel: "", pageIndex: null,
        excerpt: "", humanNote: text, aiNote: "", uncertainNote: "",
        origin: "user-note-unverified", link: this.itemLink(note)
      });
    }
    sources.sort((a, b) => a.id.localeCompare(b.id));
    const snapshot = Zotero.Utilities.Internal.md5(JSON.stringify(sources));
    return { parent, citation: this.citation(parent), sources, snapshot };
  },

  sourceHTML(source) {
    const e = value => this.escape(value);
    const page = source.pageLabel ? `Page ${source.pageLabel}` : "Page label unavailable";
    const blocks = [`<p><a href="${e(source.link)}">${e(source.kind === "note" ? "Open original note" : page)}</a></p>`];
    if (source.excerpt) blocks.push(`<blockquote>${e(source.excerpt)}</blockquote>`);
    if (source.humanNote) blocks.push(`<p><strong>${source.kind === "note" ? "Saved Zotero note" : "Comment on this passage"}:</strong> ${e(source.humanNote).replace(/\n/g, "<br>")}</p>`);
    if (source.aiNote) blocks.push(`<p><strong>AI explanation (not checked):</strong> ${e(source.aiNote).replace(/\n/g, "<br>")}</p>`);
    if (source.uncertainNote) blocks.push(`<p><strong>Earlier comment (author unknown):</strong> ${e(source.uncertainNote).replace(/\n/g, "<br>")}</p>`);
    return blocks.join("\n");
  },

  readingNoteHTML(packet) {
    const e = value => this.escape(value);
    const c = packet.citation;
    return `<h1>Reading note: ${e(c.title)}</h1>`
      + `<p>${e(c.authors.join("; "))}${c.date ? ` (${e(c.date)})` : ""}. <a href="${e(c.link)}">Open reading in Zotero</a></p>`
      + `<p>Created ${e(new Date().toISOString().slice(0, 10))}. Based on ${packet.sources.length} highlights or notes saved when this note was created.</p>`
      + `<h2>My question</h2><p>What brought me to this reading?</p>`
      + `<h2>What I read</h2><p>Which pages or sections did I read?</p>`
      + `<h2>Author's argument</h2><p>What does the author argue?</p>`
      + `<h2>Evidence and method</h2><p>What evidence or reasoning supports the argument?</p>`
      + `<h2>My interpretation</h2><p>What do I make of the argument?</p>`
      + `<h2>Connections and limits</h2><p>Where does this fit with other work? What remains unresolved?</p>`
      + `<h2>Possible use in my paper</h2><p>Where might I cite this, and for what claim?</p>`
      + `<h2>Highlights and notes</h2>`
      + (packet.sources.map(source => this.sourceHTML(source)).join("\n") || "<p>There were no saved highlights or comments when you opened this note. You can still write here.</p>");
  },

  async createReadingNote(item) {
    const packet = await this.collect(item);
    if (!packet.parent.isRegularItem?.()) throw new Error("Create a bibliographic parent item for this PDF before creating a reading note.");
    const existing = (packet.parent.getNotes?.() || []).map(id => Zotero.Items.get(id))
      .filter(note => note && !note.deleted && this.hasTag(note, this.NOTE_TAG));
    // Older versions could create several notes. Keep all of them and reopen the most recent.
    if (existing.length) {
      if (existing.some(note => note.id === item.id)) return item;
      return existing.sort((a, b) => String(b.dateAdded || "").localeCompare(String(a.dateAdded || "")) || b.id - a.id)[0];
    }
    const note = new Zotero.Item("note");
    note.libraryID = packet.parent.libraryID;
    note.parentID = packet.parent.id;
    note.setNote(this.readingNoteHTML(packet));
    note.addTag(this.NOTE_TAG, 1);
    note.addTag(`${this.SNAPSHOT_PREFIX}${packet.snapshot}`, 1);
    await note.saveTx();
    return note;
  },

  reviewState(note, snapshot) {
    const matching = this.hasTag(note, `${this.SNAPSHOT_PREFIX}${snapshot}`);
    if (!matching) return "sources-changed";
    return this.hasTag(note, this.REVIEW_TAG) ? "reviewed" : "draft";
  },

  async exportPacket(items) {
    const parents = new Map();
    for (const item of items) {
      const parent = this.parent(item);
      if (parent?.key && !parent.isNote?.() && (parent.isRegularItem?.() || parent.isPDFAttachment?.())) parents.set(`${parent.libraryID}:${parent.key}`, parent);
    }
    if (!parents.size) throw new Error("Select readings or a collection containing readings first.");
    const readings = [];
    for (const parent of parents.values()) {
      const packet = await this.collect(parent);
      const notes = (parent.getNotes?.() || []).map(id => Zotero.Items.get(id)).filter(note => note && !note.deleted && this.hasTag(note, this.NOTE_TAG));
      readings.push({
        citation: packet.citation, tags: this.tags(parent), snapshot: packet.snapshot,
        sources: packet.sources,
        readingNotes: notes.map(note => ({
          key: note.key, link: this.itemLink(note), html: note.getNote(),
          text: this.plainText(note.getNote()), reviewState: this.reviewState(note, packet.snapshot)
        }))
      });
    }
    // Native translators own bibliography formatting and citation keys.
    const translation = new Zotero.Translate.Export();
    translation.setItems([...parents.values()]);
    const translators = await translation.getTranslators();
    const translator = translators.find(t => t.label === "Better BibTeX") || translators.find(t => t.label === "BibTeX");
    if (!translator) throw new Error("Zotero's BibTeX exporter is unavailable. No files were saved.");
    translation.setTranslator(translator);
    translation.setDisplayOptions({ exportNotes: false, exportFileData: false });
    await translation.translate();
    if (!translation.string?.trim()) throw new Error("Zotero returned an empty bibliography. No files were saved.");
    const data = { schema: "annotex-writing-packet/v1", createdAt: new Date().toISOString(), coverage: "Saved passages and notes only. Review originals before citing.", bibliographyTranslator: translator.label, readings };
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Annotex reading notes</title><style>body{font:17px/1.6 system-ui;max-width:850px;margin:40px auto;padding:0 24px}blockquote{border-left:3px solid #999;padding-left:16px}article{border-top:2px solid #777;margin-top:35px}a{color:#6537ac}</style></head><body><h1>Reading notes and bibliography</h1><p>${this.escape(data.coverage)}</p>`
      + readings.map(reading => `<article><h2>${this.escape(reading.citation.title)}</h2><p>${this.escape(reading.citation.authors.join("; "))} ${this.escape(reading.citation.date)} | <a href="${this.escape(reading.citation.link)}">Zotero source</a></p><p>Tags: ${this.escape(reading.tags.join(", "))}</p>`
        + reading.readingNotes.map(note => `<h3>Reading note${note.reviewState === "sources-changed" ? " (highlights or notes have changed since it was created)" : note.reviewState === "reviewed" ? " (marked as reviewed)" : ""}</h3><pre style="white-space:pre-wrap;font:inherit">${this.escape(note.text)}</pre>`).join("\n")
        + `<h3>Current highlights and notes (${reading.sources.length})</h3>${reading.sources.map(s => this.sourceHTML(s)).join("\n")}</article>`).join("\n") + "</body></html>";
    return { data, html, bibliography: translation.string };
  },

  async savePacket(items) {
    const { FilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");
    const picker = new FilePicker();
    picker.init(Zotero.getMainWindow(), "Choose a folder for your notes and bibliography", picker.modeGetFolder);
    if (await picker.show() !== picker.returnOK) return null;
    const packet = await this.exportPacket(items);
    const folder = Zotero.File.pathToFile(picker.file);
    folder.append(`Annotex-writing-packet-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    const directory = folder.path;
    await Zotero.File.createDirectoryIfMissingAsync(directory);
    const pathFor = name => { const file = folder.clone(); file.append(name); return file.path; };
    await Zotero.File.putContentsAsync(pathFor("reading-notes.html"), packet.html);
    await Zotero.File.putContentsAsync(pathFor("source-map.json"), JSON.stringify(packet.data, null, 2));
    await Zotero.File.putContentsAsync(pathFor("references.bib"), packet.bibliography);
    return directory;
  }
};
