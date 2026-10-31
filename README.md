# Merge Gate Explainer

The Jira-side companion of [Merge Policy Gate](https://github.com/vigohan95/merge-policy-gate), a Bitbucket Cloud
custom merge check that judges pull requests against `MERGE-POLICY.md` and cites rule numbers. The Explainer is a Forge
app for Jira with a Rovo agent that answers, in one screen, the question every held pull request raises:
**why, and what do I do now?**

Built for Codegeist 2026. MIT licensed.

## What it does

- **Explains a verdict.** "Why is pull request 2 in hanvigo-dev/gate-demo held?" → live evaluation through the gate,
  one line per cited rule with its reason, then the shortest unblock step. Rules are quoted as `§2.1`, `§3.4`, so the
  answer can be grepped in the policy file.
- **Starts from the work item.** "Which pull requests of KAN-3 are held?" → the work item's status and assignee from the
  **Teamwork Graph** (`requestTeamworkGraph`: `objects(ids)` and `jiraWorkItemLinkedExternalPullRequests`), every pull
  request the gate has evaluated for that key, re-checked against the current status so the policy's
  `jira_allowed_statuses` rule (§4.1) applies with real data.
- **Teaches the policy.** "What does rule 2.2 mean?" and "Give me a starter MERGE-POLICY.md" are handled by the
  `adopt-merge-policy` skill, which also explains which keys to tune first.
- **Never bypasses.** The agent is instructed, in the prompt and in both skills, to suggest satisfying a rule or
  changing the policy on the destination branch through a reviewed pull request, never disabling the check.

## Modules

| Module | Key | Purpose |
|---|---|---|
| `rovo:agent` | `merge-gate-explainer` | the agent: prompt in `resources/prompts/`, five conversation starters, `followUpPrompt` |
| `rovo:skill` | `unblock-held-pull-request` | the diagnosis procedure, answer format, rule → action map, `references/rule-catalogue.md` |
| `rovo:skill` | `adopt-merge-policy` | onboarding a repository: template, which keys to tune, where to enable the check |
| `action` | `connect-gate` | stores the gate's verdict-feed URL for this site |
| `action` | `explain-pull-request`, `stored-verdict` | live / stored verdict for one pull request |
| `action` | `work-item-pull-requests` | Jira key → Teamwork Graph status and linked pull requests → gate verdicts |
| `action` | `explain-rule`, `policy-template` | the rule catalogue and the starter file |

Scopes: `storage:app`, `read:jira-work`, and the read-only graph scopes `read:graph:issue:jira`,
`read:graph:issue-status:jira`, `read:graph:pull-request:external`, `read:graph:user:atlassian`. Egress is limited to
`*.hello.atlassian-dev.net` (Forge web triggers).

## How the two apps talk

A Forge app holds either Bitbucket workspace scopes or Jira site scopes, never both, so the gate publishes its
verdicts on a read-only web trigger (the *verdict feed*) and the Explainer reads it:

```
GET <feed>?workspace=w&repository=r&pr=2            stored verdict (404 if never evaluated)
GET <feed>?workspace=w&repository=r&pr=2&live=1     fresh evaluation, optional &jiraStatus=In%20Review
GET <feed>?jira=KAN-3                               every evaluated pull request of a work item
```

A verdict is already visible to anyone who can open the pull request, so the feed carries nothing secret and only
reads. The same feed drives the Jira Automation template in [`docs/AUTOMATION.md`](docs/AUTOMATION.md): comment on a
work item when it is moved to a ready status while a pull request is still held, with no code.

## Try it

1. Install the gate on a Bitbucket workspace and the Explainer on a Jira site (installation links are on the Devpost
   page; see `JUDGES.md` in the gate repository for the full judge path).
2. In Rovo chat choose **Merge Gate Explainer** and paste the gate's feed URL:
   `Connect this site to the Merge Policy Gate. The verdict feed URL is https://…hello.atlassian-dev.net/x1/…`
3. Ask the conversation starters.

## Develop

```
npm install
forge lint
forge deploy -e development
forge install --upgrade --site <site>.atlassian.net --product jira -e development   # after scope changes
```

The Teamwork Graph query was verified by introspecting the live schema (`/gateway/api/graphql/twg`): the documented
`jiraWorkItem` root field does not exist, objects are fetched with `objects(ids)`, and operation names must follow the
`<company>_<operation>` shape.
