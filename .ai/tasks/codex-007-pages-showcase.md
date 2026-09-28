# Codex 007 — Publish the showcase through GitHub Pages

## STATUS

IN PROGRESS — Pages workflow updated; commit, remote deployment, and URL verification remain.

## OBJECTIVE

Make `showcase/index.html` publicly accessible from other devices through this repository's
GitHub Pages site.

## DECISIONS

- Keep the existing graph site at the root URL.
- Publish the showcase at `/showcase/` with its local assets and media.
- Let the Pages workflow enable the repository's Pages site when it runs.
- Preserve all pre-existing working-tree changes outside the deployment files.

## NEXT

- Commit only the Pages workflow and this task's coordination files.
- Push to `main`, wait for the Pages workflow, and verify the public showcase URL.
