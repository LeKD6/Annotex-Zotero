var AnnotexZotero;
var AnnotexResearch;
var AnnotexProvider;

async function startup({ id, version, rootURI }) {
  for (const script of ["research", "provider", "annotex"]) Services.scriptloader.loadSubScript(`${rootURI}content/${script}.js`);
  await AnnotexZotero.init({ id, version, rootURI });
  await AnnotexZotero.start();
}
async function shutdown() {
  await AnnotexZotero?.shutdown();
  AnnotexZotero = AnnotexResearch = AnnotexProvider = undefined;
}
async function onMainWindowLoad({ window }) { AnnotexZotero?.onMainWindowLoad(window); }
async function onMainWindowUnload({ window }) { AnnotexZotero?.onMainWindowUnload(window); }
function install() {}
function uninstall() {}
