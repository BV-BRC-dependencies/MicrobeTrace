# MAAGE Integration for MicrobeTrace

This fork of [MicrobeTrace](https://github.com/CDCgov/MicrobeTrace) contains changes needed to integrate with the [MAAGE-Web](https://github.com/MAAGE-BRC/MAAGE-Web) genomic surveillance platform.

## Changes from Upstream

### Partner Allowlist (`src/assets/embed/partner-allowlist.json`)

Added MAAGE origins to the partner handoff allowlist so that MAAGE-Web can send files to MicrobeTrace via the postMessage-based partner handoff system.

Approved origins:
- `http://localhost:3000` / `http://127.0.0.1:3000` (development)
- `https://localhost:3000` (local HTTPS)
- `https://www.maage-brc.org` / `https://maage-brc.org` (production)
- `https://dev.maage-brc.org` (staging)

### Bridge Files (experimental)

These files were developed during exploration of an iframe-embedded approach. They are not currently used by the production integration (which uses the new-tab partner handoff), but are retained for potential future iframe embedding work.

- **`maage-bridge.js`** - Standalone JavaScript bridge that handles postMessage communication between a parent MAAGE frame and embedded MicrobeTrace. Supports loading FASTA, CSV, TSV, Newick, and session files.
- **`maage-bridge.service.ts`** - Angular service version of the same bridge, designed to be injected into MicrobeTrace's Angular app.

See the [Design Decisions section](https://github.com/MAAGE-BRC/MAAGE-Web/blob/feature/microbetrace/MICROBETRACE_INTEGRATION.md#design-decisions-iframe-vs-new-tab) in MAAGE-Web's integration docs for details on why the iframe approach was set aside.

## Building for MAAGE-Web

From the MAAGE-Web project root:

```bash
npm run build:microbetrace
```

This builds MicrobeTrace with `--base-href /microbetrace/` and copies the output to `public/microbetrace/`.

## Upstream

This fork tracks the `dev` branch of [CDCgov/MicrobeTrace](https://github.com/CDCgov/MicrobeTrace).
