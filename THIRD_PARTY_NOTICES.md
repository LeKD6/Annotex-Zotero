# Third-party notices

This standalone native plugin was extracted from the independently written
Annotex for Zotero personal plugin. It does not bundle the hosted Annotex app,
its React PDF viewer, Clerk, Stripe, Vercel code, database, or provider SDKs.
There are no npm runtime or development dependencies.

Zotero is a separately installed host application, distributed by Digital
Scholar under the GNU Affero General Public License. Zotero's reader, PDF
engine, translators and credential store remain part of that host. No Zotero
runtime or translator source is redistributed in this package. A compatible
Zotero installation is required. Zotero is not affiliated with or endorsing
Annotex.

The original hosted web app credited react-pdf-highlighter-plus and
react-pdf-highlighter under MIT (Daniel Arnould, 2023; Artem Tyurin, 2017).
Those libraries are not included in this native source package. Their existing
licenses in the separate hosted repository have not been changed.

The Annotex SVG icon and synthetic fixture text/PDF are distributed under this
package's MIT license. The fixture generator optionally uses ReportLab to
rebuild the PDF; ReportLab is not bundled and is not needed to build the XPI.

Optional cloud providers are separate services with their
own terms and licenses. No model weights, API credentials or provider code are
included. Native bibliography exports are produced by the user's installed
Zotero/Better BibTeX translator, not by an included translator or AI.
