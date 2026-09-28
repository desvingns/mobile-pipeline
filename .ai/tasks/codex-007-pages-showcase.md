# Codex 007 — Publish the showcase through GitHub Pages

## STATUS

COMPLETE — publicly deployed and verified on 2026-09-28.

## OBJECTIVE

Make `showcase/index.html` publicly accessible from other devices through this repository's
GitHub Pages site.

## DECISIONS

- Keep the existing graph site at the root URL.
- Publish the showcase at `/showcase/` with its local assets and media.
- Enable Pages once through the authenticated GitHub API; the workflow handles deployments.
- Preserve all pre-existing working-tree changes outside the deployment files.

## DELIVERY

- URL: <https://desvingns.github.io/mobile-pipeline/showcase/>
- The existing graph remains at the root URL.
- Workflow run `36391013550` succeeded on commit `4c4af6b`.

## VERIFICATION

- Showcase HTML, stylesheet, and MP4 each returned HTTP 200 over HTTPS.
- MP4 response content type: `video/mp4`.

## NOTES

- Pre-existing unrelated local edits were preserved and remain uncommitted.
