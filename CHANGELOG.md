# Changelog

## 0.4.0rc8

First public beta. Zotero checks a GitHub-hosted manifest for updates to this standalone plugin. The reading and AI workflows are unchanged from RC7.

## 0.4.0rc7

Remove the confirmation pop-up from AI actions. Enable AI in settings once to send requests when you click. Earlier opt-ins do not carry over; saved provider settings and remembered keys stay in place.

## 0.4.0rc6

Restore the purple Define and Explain buttons in the reader. Both passage actions keep the same prompts and request confirmation.
New passage results show only Annotex Definition or Annotex Explanation followed by the answer. Existing notes are unchanged.

## 0.4.0rc5

Define now pairs the term’s meaning with an example or contrast. Explain pairs the passage’s main point with the reasoning behind it. Both distinguish illustrations from the author's evidence.

## 0.4.0rc4

Replace the gateway with direct Anthropic Messages requests. Put the reading note first. Remove snapshot copies, review bookkeeping, advanced model controls and redundant passage actions from the interface. Existing notes remain intact. OpenAI remains direct; removed destinations cannot opt into a different provider or reuse keys.

## 0.4.0rc3

Fix the Zotero section header replacing its own controls. Remove local and custom model endpoints; require a fresh cloud opt-in, a provider-specific key and per-request confirmation.

## 0.4.0rc2

Restricted release archives to named files. Failed key replacement preserves the old credential, and forgetting keys disables AI even if the profile store is locked. Existing-highlight explanations respect source exclusions and stay within the active PDF. Opening a historical reading note preserves the selection; opening its parent chooses the newest snapshot. No model is included or enabled by default.

## 0.4.0rc1, 2026-11-20

- Standalone open-source candidate with a separate plugin identity and no hosted account or update feed.
- Preserved local editable reading notes, evidence snapshots, review status, exact passage links and writing-packet export from personal 0.3.0.
- Added opt-in OpenAI-compatible endpoints, loopback HTTP support, per-endpoint session or profile credentials, request confirmation, explicit token-field configuration and a finite request timeout.
- Added synthetic provider-protocol and privacy tests. Real cloud and Ollama inference are not established by those tests.
- Targets Zotero 10. Native validation and release approval remain separate from package creation.
