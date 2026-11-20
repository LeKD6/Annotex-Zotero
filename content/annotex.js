/* global Zotero, AnnotexResearch, AnnotexProvider */
var AnnotexZotero = {
  MODES: [{ id: "define", label: "Define" }, { id: "explain", label: "Explain" } ],

  async init({ id, version, rootURI }) {
    Object.assign(this, { id, version, rootURI });
    this.selectionHandler = this.renderSelectionPopup.bind(this);
    this.annotationHandler = this.renderAnnotationMenu.bind(this);
  },
  async start() {
    for (const win of Zotero.getMainWindows()) this.addToWindow(win);
    Zotero.Reader.registerEventListener("renderTextSelectionPopup", this.selectionHandler, this.id);
    Zotero.Reader.registerEventListener("createAnnotationContextMenu", this.annotationHandler, this.id);
    Zotero.ItemPaneManager.registerSection({
      paneID: "annotex-open-pane", pluginID: this.id, bodyXHTML: this.markup(),
      header: { l10nID: "annotex-open-header", icon: `${this.rootURI}icons/annotex.svg` },
      sidenav: { l10nID: "annotex-open-nav", icon: `${this.rootURI}icons/annotex.svg` },
      onItemChange: ({ item, setEnabled }) => setEnabled(Boolean(item?.isRegularItem?.() || item?.isPDFAttachment?.() || item?.isNote?.())),
      onInit: props => this.initPane(props),
      onRender: ({ body, item }) => { body._annotexItem = item; this.renderSettings(body); }
    });
  },
  async shutdown() {
    for (const win of Zotero.getMainWindows()) this.removeFromWindow(win);
    AnnotexProvider.shutdown();
    // Zotero unregisters reader listeners and sections by plugin ID on shutdown.
  },
  onMainWindowLoad(win) { this.addToWindow(win); },
  onMainWindowUnload(win) { this.removeFromWindow(win); },
  addToWindow(win) {
    win.MozXULElement.insertFTLIfNeeded("annotex-open.ftl");
    const popup = win.document.getElementById("menu_ToolsPopup");
    if (!popup || win.document.getElementById("annotex-open-export")) return;
    const menu = win.document.createXULElement("menuitem");
    menu.id = "annotex-open-export";
    menu.setAttribute("label", "Annotex: Export notes and bibliography…");
    menu.addEventListener("command", () => void this.exportReadings());
    popup.appendChild(menu);
  },
  removeFromWindow(win) {
    win.document.getElementById("annotex-open-export")?.remove();
    win.document.querySelector('[href="annotex-open.ftl"]')?.remove();
  },
  markup() {
    const button = (name, label) => `<html:button type="button" data-annotex-${name}="true" style="padding:7px;cursor:pointer;">${label}</html:button>`;
    return `<html:div style="display:grid;gap:9px;padding:10px;font-size:12px;">
      ${button("reading", "Open reading note")}
      <html:div>The first time you open a note, Annotex adds this reading’s highlights and comments. Your edits stay in Zotero.</html:div>
      ${button("export", "Export notes and bibliography…")}
      ${button("summary", "Summarize highlights and notes with AI")}
      <html:details><html:summary>AI settings</html:summary>
        <html:div style="display:grid;gap:8px;margin-top:8px;">
          <html:div>With AI enabled, clicking Define or Explain sends the selected text and document title to your chosen provider. Summarizing sends the title, saved passages and notes, and their references. Your provider may charge for requests. Annotex does not send the PDF.</html:div>
          <html:label><html:input type="checkbox" data-annotex-enabled="true" /> Enable AI and send requests when I click</html:label>
          <html:label>Provider<html:select data-annotex-endpoint="true">${Object.entries(AnnotexProvider.clouds).map(([url, name]) => `<html:option value="${url}">${name}</html:option>`).join("")}</html:select></html:label>
          <html:label>Model ID from your provider<html:input type="text" data-annotex-model="true" style="width:100%;" /></html:label>
          <html:label>API key<html:input type="password" autocomplete="off" data-annotex-key="true" style="width:100%;" /></html:label>
          <html:label><html:input type="checkbox" data-annotex-remember="true" /> Remember this key after I close Zotero</html:label>
          <html:div>Leave the key blank to keep one you already saved for this provider.</html:div>
          ${button("save", "Save AI settings")}${button("forget", "Forget saved keys and turn off AI")}
          <html:div data-annotex-status="true" role="status"></html:div>
        </html:div>
      </html:details>
    </html:div>`;
  },
  initPane({ body }) {
    const get = name => body.querySelector(`[data-annotex-${name}]`);
    const current = () => body._annotexItem || Zotero.getActiveZoteroPane()?.getSelectedItems?.()?.[0];
    get("endpoint").addEventListener("change", () => { get("key").value = ""; get("remember").checked = false; get("model").value = ""; });
    get("reading").addEventListener("click", () => void this.openReadingNote(current()));
    get("export").addEventListener("click", () => void this.exportReadings([current()].filter(Boolean)));
    get("summary").addEventListener("click", () => void this.summarizeAttachment(current(), get("summary")));
    get("save").addEventListener("click", async () => {
      try {
        await AnnotexProvider.save({ baseURL: get("endpoint").value, model: get("model").value, enabled: get("enabled").checked, tokenParameter: "auto", reasoning: "" }, get("key").value, get("remember").checked);
        get("key").value = "";
        get("remember").checked = false;
        get("status").textContent = "Settings saved. No text was sent.";
      } catch (_) { get("key").value = ""; get("status").textContent = "Settings could not be saved. Choose a provider and model, and enter its key to enable AI. No text was sent."; }
    });
    get("forget").addEventListener("click", () => {
      try { AnnotexProvider.forget(); get("key").value = ""; get("enabled").checked = false; get("status").textContent = "Provider keys removed. AI is off."; }
      catch (_) { get("enabled").checked = false; get("key").value = ""; get("status").textContent = "AI is off. Stored keys could not all be removed. Unlock the credential store and try again."; }
    });
    this.renderSettings(body);
  },
  renderSettings(body) {
    if (body._annotexSettingsLoaded) return;
    body._annotexSettingsLoaded = true;
    const c = AnnotexProvider.config();
    const get = name => body.querySelector(`[data-annotex-${name}]`);
    get("endpoint").value = c.baseURL; get("model").value = c.model;

    if (!c.baseURL) get("status").textContent = "Your previous provider is no longer supported. Choose OpenAI or Claude and enter its API key.";
    get("enabled").checked = c.enabled;
  },

  renderSelectionPopup({ reader, doc, params, append }) {
    if (!params?.annotation?.text?.trim()) return;
    const row = doc.createElement("div");
    row.setAttribute("data-annotex-open", "selection-tools");
    Object.assign(row.style, { display: "flex", gap: "5px", padding: "6px 8px", flexWrap: "wrap", borderTop: "1px solid rgba(127,127,127,.28)" });
    for (const mode of this.MODES) {
      const button = doc.createElement("button");
      button.type = "button"; button.textContent = mode.label;
      button.title = `Annotex: ${mode.label}. If AI is enabled, this sends the selected text and title to your provider.`;
      const primary = mode.id === "explain";
      Object.assign(button.style, {
        border: "1px solid #7c3aed", borderRadius: "6px", padding: "4px 7px",
        background: primary ? "#7c3aed" : "transparent",
        color: primary ? "white" : "light-dark(#7c3aed, #c4b5fd)",
        fontSize: "11px", fontWeight: "600", cursor: "pointer"
      });
      button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); void this.handleSelection(reader, params.annotation, mode, button); });
      row.appendChild(button);
    }
    append(row);
  },
  renderAnnotationMenu({ reader, params, append }) {
    if (!params?.ids?.length) return;
    for (const mode of this.MODES) append({ label: `Annotex: ${mode.label}`, onCommand: () => void this.handleExistingAnnotations(reader, params.ids, mode) });
  },
  async handleSelection(reader, selection, mode, button) {
    const label = button.textContent; button.disabled = true; button.textContent = "Asking your provider…";
    try {
      const attachment = reader?._item;
      if (!attachment) throw new Error("Could not identify this PDF attachment.");
      const result = await this.generateExplanation({ selection: selection.text, documentTitle: this.getDocumentTitle(attachment), mode: mode.id });
      await this.saveSelectionResult(attachment, selection, result, mode.label);
      this.notify("Annotex", "AI explanation saved. Your original comments are unchanged.");
    } catch (error) { this.notify("Annotex", error.message, true); }
    finally { button.disabled = false; button.textContent = label; }
  },
  async generateExplanation(payload) {
    if (typeof payload.selection !== "string" || !payload.selection.trim() || payload.selection.length > 12000) throw new Error("Select between 1 and 12000 characters for an explanation.");
    return AnnotexProvider.complete({ prompt: AnnotexProvider.explanationPrompt(payload), maxTokens: 800 });
  },
  resolveAnnotation(attachment, id) {
    return attachment.getAnnotations().find(a => !a.deleted && (typeof id === "number" ? a.id === id : a.key === id) && !AnnotexResearch.hasTag(a, "annotex:exclude"));
  },
  annotationPageIndex(annotation) {
    try { return JSON.parse(annotation.annotationPosition || "{}").pageIndex; } catch (_) { return undefined; }
  },
  async handleExistingAnnotations(reader, ids, mode) {
    if (this.explanationBusy) return;
    this.explanationBusy = true;
    try {
      const attachment = reader?._item;
      if (!attachment) throw new Error("Could not identify this PDF attachment.");
      let saved = 0;
      for (const id of ids) {
        const annotation = this.resolveAnnotation(attachment, id);
        if (!annotation?.annotationText) continue;
        const result = await this.generateExplanation({ selection: annotation.annotationText, documentTitle: this.getDocumentTitle(attachment), mode: mode.id });
        await this.saveChildNote(attachment, this.passageHeading(mode.label), result.content, {
          link: AnnotexResearch.annotationLink(attachment, annotation.key, this.annotationPageIndex(annotation))
        });
        saved++;
      }
      this.notify("Annotex", saved ? "Separate AI notes saved. Original comments are preserved." : "Select a highlight with text first. Nothing was sent.");
    } catch (error) { this.notify("Annotex", error.message, true); }
    finally { this.explanationBusy = false; }
  },
  passageHeading(label) {
    return label === "Define" ? "Annotex Definition" : "Annotex Explanation";
  },
  getAnnotationSortIndex(selection) {
    if (selection.sortIndex?.trim()) return selection.sortIndex.trim();
    const index = selection.position?.pageIndex;
    return `${String(Number.isInteger(index) && index >= 0 ? index : 0).padStart(5, "0")}|000000|00000`;
  },
  async saveSelectionResult(attachment, selection, result, label) {
    const heading = this.passageHeading(label);
    if (!selection.position) return this.saveChildNote(attachment, heading, result.content);
    const comment = `${heading}\n\n${result.content}`;
    const annotation = await Zotero.Annotations.saveFromJSON(attachment, { key: Zotero.DataObjectUtilities.generateKey(), type: selection.type || "highlight", text: selection.text, comment, color: selection.color || "#a78bfa", pageLabel: selection.pageLabel || "", sortIndex: this.getAnnotationSortIndex(selection), position: selection.position });
    annotation.addTag(AnnotexResearch.AI_TAG, 1);
    annotation.addTag(`annotex:ai-hash:${Zotero.Utilities.Internal.md5(comment)}`, 1);
    await annotation.saveTx();
    return annotation;
  },
  async saveChildNote(item, heading, content, { link = "", showTitle = false } = {}) {
    const parent = AnnotexResearch.parent(item);
    if (!parent?.isRegularItem?.()) throw new Error("Create a bibliographic parent item for this PDF before saving a reading note.");
    const note = new Zotero.Item("note"); note.libraryID = parent.libraryID; note.parentID = parent.id;
    const e = value => AnnotexResearch.escape(value);
    const title = link ? `<a href="${e(link)}">${e(heading)}</a>` : e(heading);
    note.setNote(`<h1>${title}</h1>${showTitle ? `<p>${e(this.getDocumentTitle(item))}</p>` : ""}<p>${e(content).replace(/\n/g, "<br>")}</p>`);
    note.addTag(AnnotexResearch.AI_TAG, 1); await note.saveTx(); return note;
  },
  async generateSummary(sources, title) {
    const result = await AnnotexProvider.complete({ prompt: AnnotexProvider.synthesisPrompt(sources, title), maxTokens: 4000 });
    return { ...result, content: AnnotexProvider.normalizeReferences(result.content, sources) };
  },
  async summarizeAttachment(item, button) {
    const label = button.textContent; button.disabled = true; button.textContent = "Summarizing…";
    try {
      const packet = await AnnotexResearch.collect(item);
      const sources = packet.sources.filter(s => s.origin !== "ai").map(s => ({ ...s, aiNote: "", uncertainNote: "" }));
      if (!sources.length) throw new Error("This reading has no saved passages or notes to synthesize.");
      let result = await this.generateSummary(sources, packet.citation.title);
      // Preserve the testing/extension hook used by the original personal plugin.
      if (typeof result === "string") result = { content: result, model: "not reported" };
      const note = await this.saveChildNote(item, "AI summary of highlights and notes", `AI draft. Check the cited passages.\nModel: ${result.model}\n\n${result.content}`, { showTitle: true });
      let html = note.getNote();
      for (const source of sources) html = html.replaceAll(`[Source ${source.id}]`, `<a href="${AnnotexResearch.escape(source.link)}">[${AnnotexResearch.escape(source.pageLabel ? `p. ${source.pageLabel}` : "source note")}]</a>`);
      note.setNote(html + `<p>This summary covers ${sources.length} saved highlights or notes. It does not cover the full paper.</p><h2>Included sources</h2>` + sources.map(s => AnnotexResearch.sourceHTML(s)).join("\n"));
      await note.saveTx(); this.notify("Annotex", "AI summary saved as a separate Zotero note.");
    } catch (error) { this.notify("Annotex", error.message, true); }
    finally { button.disabled = false; button.textContent = label; }
  },
  async openReadingNote(item) {
    if (this.noteBusy) return; this.noteBusy = true;
    try { const note = await AnnotexResearch.createReadingNote(item); await Zotero.getActiveZoteroPane().selectItem(note.id); }
    catch (error) { this.notify("Annotex", error.message, true); }
    finally { this.noteBusy = false; }
  },
  async exportReadings(selection) {
    try {
      const items = selection || Zotero.getActiveZoteroPane()?.getSelectedItems?.() || [];
      if (!items.length) throw new Error("Select readings in the items list first. For a whole collection, select its readings with Command/Ctrl-A.");
      const directory = await AnnotexResearch.savePacket(items);
      if (directory) this.notify("Annotex", `Notes and bibliography saved to ${directory}`);
    } catch (error) { this.notify("Annotex", error.message, true); }
  },
  getDocumentTitle(item) { return AnnotexResearch.parent(item)?.getField?.("title") || "Untitled reading"; },
  notify(title, message, error = false) {
    const progress = new Zotero.ProgressWindow({ closeOnClick: true });
    progress.changeHeadline(title); progress.addDescription(message); progress.show(); progress.startCloseTimer(error ? 9000 : 4500);
  }
};
