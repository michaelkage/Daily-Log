<!-- START -->
## 📊 Engineering Dashboard

![Total logs](https://img.shields.io/badge/logs-1-2563eb?style=flat-square)
![Current streak](https://img.shields.io/badge/current%20streak-1%20day-16a34a?style=flat-square)

Public engineering journal — experiments, shipped work, lessons, and next steps.

### Recent entries

| Date (UTC) | Highlight | Tags |
|---|---|---|
| [2026-11-11](logs/2026/11/2026-11-11.md) | Daily engineering log | — |

### Archive

Browse the complete history in [logs/](logs/) and weekly reviews in [weekly/](weekly/).

### Portfolio integration

Fetch [latest.json](latest.json) for the latest highlight, entry URL, total log count, and current streak. The daily automation refreshes this machine-readable file with the dashboard.

### Capture a day

[Open a Daily Log issue](../../issues/new?template=daily-log.yml) to record your progress without editing Markdown by hand.

### Configuration

Add a `GH_ACTIVITY_TOKEN` Actions secret containing a fine-grained personal access token with read-only **Contents**, **Pull requests**, and **Metadata** permissions for the repositories you want scanned. The daily collector discovers repositories available to that token automatically; no repository list is required. A repository is recorded only when it has at least one commit in the previous 24 hours, then its commit details and any merged PRs/releases from that same window are added. Repositories with no commits are skipped. Optionally set `GH_ACTIVITY_REPOS` to add specific `owner/repository` names. Without `GH_ACTIVITY_TOKEN`, only this repository and explicitly configured repositories can be scanned.

<!-- END -->

## About

This repository documents daily engineering progress and lessons learned, building in public one commit at a time.

_Repository established February 3, 2026. The original launch notes are preserved in the repository history._
