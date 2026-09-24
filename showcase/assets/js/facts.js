/* facts.js — every number shown on the site. Verified against the repo (see docs/brand.md §6);
 * tools/check.cjs re-checks version against ../VERSION. */
window.MP_FACTS = {
  version: '1.17.2',
  releases: 25,             // CHANGELOG entries since 1.0.0
  since: '18 мая 2026',
  agents: 49,               // agent templates: 22 spec + 27 dev (incl. 5 iOS stubs)
  agentsSpec: 22,
  agentsDev: 27,
  scripts: 22,              // runnable deterministic scripts: 23 .sh in templates minus the sourced crawl library _crawl-lib.sh
  modes: 15,                // /mp modes in manifest.tsv
  humanYes: 4,              // story gates: screens list, whole spec, task plan, release
  autofix: 1,               // automatic fix attempts after failed tests
  repairRounds: 2,          // semantic repair rounds before the architect capsule
  criticReturns: 2,         // spec-evaluator returns to the owning author
  specSheets: 18,           // ~files in the spec bundle
  scouts: 3,                // grounding scouts in parallel
  interviewStages: 5,
  interviewQuestions: 4,
  fitThreshold: 85,
  verifierChecks: 6
};
