import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";

const records = new Map();
let nextID = 100;
class Note {
  constructor() { this.id = nextID++; this.key = `NOTE${this.id}`; this.tags = []; }
  isNote() { return true; }
  setNote(html) { this.html = html; }
  getNote() { return this.html || ""; }
  getTags() { return this.tags.map(tag => ({ tag })); }
  addTag(tag) { if (!this.tags.includes(tag)) this.tags.push(tag); }
  async saveTx() {
    records.set(this.id, this);
    if (!records.get(this.parentID).notes.includes(this.id)) records.get(this.parentID).notes.push(this.id);
  }
}
const parent = {
  id: 1, key: "PAPER001", libraryID: 1, notes: [],
  isRegularItem: () => true,
  getAttachments: () => [2], getNotes() { return this.notes; },
  getTags: () => [{ tag: "chapter2" }],
  getCreators: () => [{ firstName: "Herbert", lastName: "Simon" }],
  getField: field => ({ title: "Research <evidence>", date: "1947", DOI: "10.test/source" })[field] || ""
};
const human = { id: 3, key: "HUMAN001", annotationText: "Exact source passage.", annotationComment: "My original interpretation.", annotationPageLabel: "xiv", annotationPosition: '{"pageIndex":4}', getTags: () => [], async saveTx() { throw new Error("Human annotation must never be saved by explanation"); } };
const sticky = { key: "STICKY01", annotationText: "", annotationComment: "A comment-only note.", annotationPageLabel: "3", annotationPosition: '{"pageIndex":7}', getTags: () => [] };
const legacy = { key: "LEGACY01", annotationText: "An older passage.", annotationComment: "Annotex Explain\n\nOlder AI prose, possibly edited.", getTags: () => [] };
const ai = { key: "AINOTE01", annotationText: "AI selected passage.", annotationComment: "AI explanation", getTags: () => [{ tag: "annotex:ai" }] };
const attachment = { id: 2, key: "PDF00001", parentID: 1, libraryID: 1, isPDFAttachment: () => true, getAnnotations: () => [human, sticky, legacy, ai] };
records.set(1, parent); records.set(2, attachment); records.set(3, human);
const child = new Note(); child.libraryID = 1; child.parentID = 1; child.setNote("An ordinary child note."); await child.saveTx();
const excluded = new Note(); excluded.libraryID = 1; excluded.parentID = 1; excluded.setNote("Do not include this."); excluded.addTag("annotex:exclude"); await excluded.saveTx();

const Zotero = {
  Items: { get: id => records.get(id), getByLibraryAndKey: (_library, key) => [...records.values()].find(item => item.key === key) },
  Libraries: { get: () => ({ libraryType: "user" }) },
  URI: { getItemURI: item => `http://zotero.org/users/1/items/${item.key}` },
  Utilities: { Internal: { md5: input => createHash("md5").update(input).digest("hex") } },
  Item: Note,
  getMainWindow: () => ({}),
  Translate: { Export: class {
    setItems(items) { this.items = items; }
    async getTranslators() { return [{ label: "BibTeX", translatorID: "native" }]; }
    setTranslator(translator) { this.translator = translator; }
    setDisplayOptions(options) { assert.equal(options.exportNotes, false); }
    async translate() { this.string = "@book{native_key, title={Research evidence}}"; }
  } },
  logError(error) { throw error; }
};
const sandbox = vm.createContext({ Zotero, console, setTimeout, clearTimeout });
for (const name of ["research", "annotex"]) {
  // annotex.js assigns a previously declared bootstrap global.
  if (name === "annotex") sandbox.AnnotexZotero = undefined;
  vm.runInContext(await readFile(new URL(`../content/${name}.js`, import.meta.url), "utf8"), sandbox);
}
const research = sandbox.AnnotexResearch;
// Parsing is supplied by Zotero's DOMParser in production; source fixtures here
// are already plain text, so these tests focus on collection and preservation.
research.plainText = text => text;
const packet = await research.collect(attachment);
assert.equal(packet.sources.length, 5);
const original = packet.sources.find(s => s.annotationKey === human.key);
assert.equal(original.pageLabel, "xiv");
assert.equal(original.pageIndex, 4);
assert.match(original.link, /page=5&annotation=HUMAN001$/);
assert.equal(original.humanNote, "My original interpretation.");
assert.ok(packet.sources.some(s => s.annotationKey === sticky.key));
assert.ok(packet.sources.some(s => s.noteKey === child.key));
assert.equal(packet.sources.find(s => s.annotationKey === legacy.key).origin, "uncertain-legacy");
assert.equal(packet.sources.find(s => s.annotationKey === legacy.key).humanNote, "");
assert.equal(packet.sources.find(s => s.annotationKey === ai.key).humanNote, "");
assert.equal(packet.sources.find(s => s.annotationKey === ai.key).origin, "uncertain-legacy", "edited or unversioned AI text must not be attributed to the researcher");

const note = await research.createReadingNote(attachment);
assert.match(note.getNote(), /My interpretation/);
assert.match(note.getNote(), /Research &lt;evidence&gt;/);
assert.equal(research.reviewState(note, packet.snapshot), "draft");
note.setNote(note.getNote() + "<p>My manually written argument.</p>");
assert.equal((await research.createReadingNote(parent)).id, note.id);
assert.match(note.getNote(), /My manually written argument/);
note.addTag(research.REVIEW_TAG, 1); // Simulate a note reviewed in an earlier release.
assert.equal(research.reviewState(note, packet.snapshot), "reviewed");
human.annotationComment = "My revised original interpretation.";
const changed = await research.collect(parent);
assert.equal(research.reviewState(note, changed.snapshot), "sources-changed");
const revision = new Note(); revision.libraryID = note.libraryID; revision.parentID = parent.id;
revision.setNote("Older release: additional reading note"); revision.addTag(research.NOTE_TAG); await revision.saveTx();
assert.notEqual(revision.id, note.id);
assert.match(note.getNote(), /My manually written argument/);
assert.equal((await research.collect(parent)).sources.length, 5, "research notes must not recursively become source notes");

const plugin = sandbox.AnnotexZotero;
assert.equal((await research.createReadingNote(note)).id, note.id);
parent.notes.reverse();
assert.equal((await research.createReadingNote(parent)).id, revision.id);
parent.notes.reverse();
assert.equal(plugin.resolveAnnotation({getAnnotations: () => []}, human.id), undefined);
assert.equal(plugin.resolveAnnotation({getAnnotations: () => [{...human, getTags: () => [{tag:'annotex:exclude'}]}]}, human.id), undefined);
assert.equal(plugin.resolveAnnotation({getAnnotations: () => [{...human, key:'12345678'}]}, '12345678').id, human.id);
plugin.version = "0.3.0";
plugin.notify = () => {};
plugin.generateExplanation = async () => ({ content: "An explanation.", model: "test-model" });
const beforeComment = human.annotationComment;
await plugin.handleExistingAnnotations({ _item: attachment }, [3], { id: "explain", label: "Explain" });
assert.equal(human.annotationComment, beforeComment);
const explanation = [...records.values()].find(item => item.getNote?.().includes("An explanation."));
assert.ok(explanation);
assert.ok(research.hasTag(explanation, research.AI_TAG));
assert.match(explanation.getNote(), /page=5&amp;annotation=HUMAN001/);
assert.equal(explanation.getNote().replace(/<[^>]+>/g,''), 'Annotex ExplanationAn explanation.');
for (const [label,heading] of [['Define','Annotex Definition'],['Explain','Annotex Explanation']]) {
  const result = { content:'A short answer.', model:'test-model' };
  const fallback = await plugin.saveSelectionResult(attachment, {}, result, label);
  assert.equal(fallback.getNote(), '<h1>'+heading+'</h1><p>A short answer.</p>');
  sandbox.Zotero.Annotations = { saveFromJSON: async (_, input) => ({ comment: input.comment, addTag(){}, async saveTx(){} }) };
  sandbox.Zotero.DataObjectUtilities = { generateKey: () => 'TESTKEY' };
  const highlight = await plugin.saveSelectionResult(attachment, { text:'Sample', position:{pageIndex:0} }, result, label);
  assert.equal(highlight.comment, heading+'\n\nA short answer.');
}

let synthesisInputs;
plugin.generateSummary = async sources => {
  synthesisInputs = sources;
  return `A bounded interpretation [Source ${sources.find(s => s.annotationKey === human.key).id}]`;
};
await plugin.summarizeAttachment(attachment, { textContent: "Synthesize saved notes", disabled: false });
assert.ok(synthesisInputs.some(s => s.annotationKey === sticky.key));
assert.ok(synthesisInputs.some(s => s.noteKey === child.key));
assert.equal(synthesisInputs.find(s => s.annotationKey === legacy.key).uncertainNote, "", "legacy AI comments are opt-in");
const synthesisNote = [...records.values()].find(item => item.getNote?.().includes("A bounded interpretation"));
assert.match(synthesisNote.getNote(), /\[p\. xiv\]<\/a>/);
assert.match(synthesisNote.getNote(), /does not cover the full paper/);
assert.match(note.getNote(), /My manually written argument/);

const exported = await research.exportPacket([parent, attachment]);
assert.equal(exported.data.readings.length, 1, "duplicate selected parent/PDF must export once");
assert.equal(exported.data.readings[0].readingNotes[0].reviewState, "sources-changed");
assert.equal(exported.data.readings[0].sources.length, 5, "AI output must not recursively enter evidence");
assert.match(exported.bibliography, /native_key/);
assert.match(exported.html, /My manually written argument/);
assert.doesNotMatch(exported.html, /Do not include this/);
console.log("Reading workflow tests passed: comment preservation, source/page links, note types, authorship, revisions, review invalidation and export.");
