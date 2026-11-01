# Jira Automation template: "Is this work item ready to merge?"

Merge Policy Gate publishes its verdicts on a read-only web trigger (the *verdict feed*). Because a verdict is already
visible to everyone who can open the pull request, the feed needs no secret, which makes it a one-line **Send web
request** in Jira Automation. This template posts a comment on a work item whenever it is moved to a "ready" status
and any of its pull requests is still held by the gate.

What the rule does, end to end:

1. A work item (for example `KAN-3`) is transitioned to *In Review* (or whatever your "ready to merge" column is).
2. Automation calls `GET <feed>?jira=KAN-3`. The gate answers with every pull request it has evaluated for that key,
   each with `allowed`, `reasons`, `violated`, `evaluatedAt`.
3. If any pull request is held, the rule comments on the work item with the pull request numbers, the violated rules
   and the gate's one-line unblock hint; otherwise it says the gate passes.

Nothing is written to Bitbucket. The comment is the only side effect.

## Verified

Built and enabled on the Forge demo Jira site on 2026-11-01 (project KAN, rule "Merge Policy Gate: comment held pull requests on transition"). Transitioning KAN-3 produced the comment within 30 seconds: *Merge Policy Gate checked the pull requests of KAN-3 (1 evaluated): hanvigo-dev/gate-demo#3 "KAN-3: add generated fixture rows" — HELD: §3.4 size limit exceeded: 520 lines / 1 files (max 400 / 20)*. Notes from the build: the smart-values condition on that site offered no "greater than" operator, so the condition is `{{webResponse.body.pullRequests.size}}` *does not equal* `0`; the trigger was left on "any status" for the demo.

## Prerequisites

- Merge Policy Gate installed on the Bitbucket workspace, check enabled on the repository, and at least one evaluation
  of a pull request whose branch or title carries the work item key (the gate indexes verdicts by key at evaluation).
- The verdict feed URL: `forge webtrigger list -e production` in the merge-policy-gate app, key `verdict-feed`. It looks
  like `https://<hash>.hello.atlassian-dev.net/x1/<id>`.
- Jira Automation (Free plans have a monthly run limit; this rule runs once per transition).

## Build the rule (Project settings → Automation → Create rule)

| Step | Component | Settings |
|---|---|---|
| Trigger | **Work item transitioned** | To status: *In Review* (and/or *Done*). Leave *From* empty. |
| Action | **Send web request** | Web request URL: `https://<feed-host>/x1/<id>?jira={{issue.key}}` · HTTP method: `GET` · Headers: `Accept: application/json` · Web request body: *Empty* · tick **Delay execution of subsequent rule actions until we've received a response for this web request** |
| Condition | **{{smart values}} condition** | First value: `{{webResponse.status}}` · Condition: *equals* · Second value: `200` |
| Condition | **{{smart values}} condition** | First value: `{{webResponse.body.pullRequests.size}}` · Condition: *does not equal* · Second value: `0` |
| Action | **Comment on work item** | Comment text below |

Comment text (smart values iterate over the feed's `pullRequests` array):

```
*Merge Policy Gate* checked the pull requests of {{issue.key}} ({{webResponse.body.pullRequests.size}} evaluated):
{{#webResponse.body.pullRequests}}
* {{workspace}}/{{repo}}#{{prId}} "{{title}}" — {{#allowed}}PASS{{/}}{{^allowed}}HELD: {{reasons.join(" · ")}}{{/}} (evaluated {{evaluatedAt}})
{{/}}
{{#webResponse.body.pullRequests}}{{^allowed}}
Next step for #{{prId}}: {{violated.join(", ")}} — ask *Merge Gate Explainer* in Rovo chat "why is pull request {{prId}} in {{workspace}}/{{repo}} held?" for the exact unblock.
{{/}}{{/}}
```

Optional refinement: add a third condition `{{webResponse.body.pullRequests.allowed}}` *contains* `false` so the rule
stays silent when everything already passes, or split into two comment actions with the opposite condition.

## Live re-evaluation instead of the stored verdict

The stored verdict is what the merge check decided at the last push or review event. To evaluate again at transition
time (for example to apply `jira_allowed_statuses`, rule §4.1, with the work item's new status), call the feed per pull
request with `live=1&jiraStatus={{issue.status.name}}`:

```
https://<feed-host>/x1/<id>?workspace={{webResponse.body.pullRequests.first.workspace}}&repository={{webResponse.body.pullRequests.first.repo}}&pr={{webResponse.body.pullRequests.first.prId}}&live=1&jiraStatus={{issue.status.name}}
```

as a second **Send web request** inside a **Branch rule / related work items → Current work item** block. The response
is a single verdict record (`allowed`, `reasons`, `rules`, `facts`).

## Feed reference

| Request | Response |
|---|---|
| `GET ?jira=KAN-3` | `{ key, updatedAt, pullRequests: [verdict record…] }` newest first |
| `GET ?workspace=w&repository=r&pr=2` | stored verdict record, `404` if the gate never evaluated it |
| `GET ?workspace=w&repository=r&pr=2&live=1[&jiraStatus=S]` | fresh evaluation, stored as the new verdict |

Verdict record: `workspace, repo, prId, title, allowed, violated[], satisfied[], reasons[], rules[], policySource,
facts{changedFiles, changedLines, approvalsByOthers, draft, jira{key,status}}, evaluatedAt`.

## Why not a Forge trigger inside the Explainer?

The Explainer is a Jira-side app and cannot subscribe to Bitbucket events (a Forge app holds either Bitbucket workspace
scopes or Jira site scopes, not both). Automation is the product-native way to react to Jira events with the gate's
data, and it needs no code from the customer. The same feed powers the Explainer's `work-item-pull-requests` action and
the Rovo skill *unblock-held-pull-request*.
