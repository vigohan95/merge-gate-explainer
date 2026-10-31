# Privacy policy — Merge Gate Explainer

Last updated: 2026-10-31. Developer: Han Vigo (hanwg666@gmail.com).

Merge Gate Explainer is a Forge app for Jira with a Rovo agent. It explains verdicts produced by Merge Policy Gate (a
Bitbucket Cloud merge check) and enriches them with the status of the linked Jira work item.

## What the app reads

- With `read:jira-work` it reads a work item's numeric id, summary, status and assignee display name when a user asks
  about that work item.
- With the read-only Teamwork Graph scopes (`read:graph:issue:jira`, `read:graph:issue-status:jira`,
  `read:graph:pull-request:external`, `read:graph:user:atlassian`) it reads the same work item's status, assignee and
  linked pull requests, as the asking user (results are filtered to what that user may see).
- It calls the Merge Policy Gate verdict feed (a Forge web trigger on `*.hello.atlassian-dev.net`, the only permitted
  egress) to fetch verdict records: repository slug, pull request number and title, rules cited, reasons, counts.

## What the app stores

In Forge hosted storage (`storage:app`): the verdict feed URL that an administrator connected for the site. Nothing
else is persisted; work item data and verdicts are fetched on each request and returned to the conversation.

No account IDs, e-mail addresses or conversation contents are stored by the app. Rovo conversations are handled by
Atlassian under the Atlassian terms.

## Third parties

No analytics, tracking or advertising. No outbound calls other than the connected verdict feed.

## Contact

hanwg666@gmail.com, or https://github.com/vigohan95/merge-gate-explainer/issues.
