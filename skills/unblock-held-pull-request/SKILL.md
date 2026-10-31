---
name: unblock-held-pull-request
description: Diagnose why Merge Policy Gate held a Bitbucket Cloud pull request and lead the author to the shortest unblock. Use when someone asks why a pull request is held, blocked, red, or not merging, when a verdict cites rule numbers like §2.1 or §3.4, or when they ask which pull requests of a Jira work item are held. Covers reading a verdict, mapping each cited rule to one concrete action, and the exact wording to send back.
compatibility: Needs Merge Policy Gate installed on the Bitbucket workspace and this site connected to its verdict feed (connect-gate).
allowed-tools: explain-pull-request stored-verdict explain-rule work-item-pull-requests
---

# Unblock a held pull request

The gate judges a pull request against `MERGE-POLICY.md` on the **destination** branch. A verdict is `pass` or `held`,
and every verdict lists the rules it relied on (`rulesCited`) and the rules it found violated (`reasons`). Your job is
to turn that into one short answer: verdict, why, what to do next. Never invent a verdict; always read it from a tool.

## 1. Get the verdict

1. If the user gives workspace, repository and pull request number, call `explain-pull-request` (live evaluation).
2. If the user gives only a Jira key (for example `KAN-3`), call `work-item-pull-requests` with that key; it returns the
   pull requests the gate has seen for that work item with their last verdict, plus the work item's current status.
   If exactly one is held, continue with it; if several, list them one per line and ask which one to dig into.
3. If the user asks what the gate decided *earlier* (before the last push), call `stored-verdict` instead.
4. If a tool answers "not connected", ask for the verdict feed URL and hand over to `connect-gate`. Do not guess URLs.
5. Missing identifier: ask for exactly the missing piece. The number is the one in the pull request URL
   (`/pull-requests/<number>`).

## 2. Read the verdict

Fields you will use:

| Field | Meaning |
|---|---|
| `verdict` | `pass` or `held` |
| `reasons` | one string per violated rule, starting with the rule number, for example `§3.4 size limit exceeded: 520 lines / 1 files (max 400 / 20)` |
| `rulesCited` | every rule the gate checked, violated or not |
| `facts` | `changedFiles`, `changedLines`, `approvalsByOthers`, `draft`, `jira.key` |
| `policySource` | `MERGE-POLICY.md` (repo file) or `default` (built-in defaults; the repo has no policy file) |
| `howToUnblock` | one sentence per violated rule, already ordered |

`policySource: default` matters: the repository has not opted in to its own policy yet, so mention that the limits are
the built-in defaults and point to the adopt-merge-policy flow if they want to change them.

## 3. Map each violated rule to one action

Use `references/rule-catalogue.md` for the full text. The shortest unblock per rule:

- **§2.1 protected path** (CI config, Dockerfile, the policy file touched): a reviewer who is not the author approves,
  or the protected file change moves to its own pull request. Approval re-runs the check without a push.
- **§2.2 dependency change** (major bump, added or removed package): same as §2.1, approval or split. Patch and minor
  bumps never trip this rule, so if the user says it is only a bump, check `reasons` for the word *major*, *added* or
  *removed* and quote it.
- **§3.4 size limit**: split the pull request so each part stays under `max_changed_lines` / `max_changed_files`, or
  raise the limits in `MERGE-POLICY.md` on the destination branch through a reviewed pull request. Quote the numbers
  from `reasons` (actual vs max).
- **§3.5 draft**: mark the pull request ready for review. Nothing else is needed.
- **§3.6 approvals**: the gate counts only *Approved* reviews by someone other than the author; self-approval and
  "requested changes" do not count. Tell them how many more approvals are required.
- **§4.1 Jira key**: put the key in the branch name (`feature/KAN-3-...`) or the title. If the policy also lists
  `jira_allowed_statuses`, the work item must be in one of them; `work-item-pull-requests` tells you the current status.

Order the actions by cheapest first (§3.5, then §4.1, then approvals, then split). If two rules are released by the
same approval, say so once.

## 4. Answer format

Exactly this shape, no preamble:

```
hanvigo-dev/gate-demo#2 - HELD (policy=MERGE-POLICY.md, evaluated 2026-10-30 05:47 UTC)
- §2.1 Dockerfile is a protected path; 0 approvals by others.
- §2.2 httpx 0.27 -> 1.0 is a major bump.
Next: one approval from a reviewer other than the author releases both rules; no push needed.
```

For `pass`: one line ending in `- PASS`, then the rules that were checked, for example `checked §2.1 §2.2 §3.4 §3.5`.

## 5. What not to do

- Do not suggest disabling the check, force-merging, or editing `MERGE-POLICY.md` on the *source* branch (the gate
  reads the destination branch, so that has no effect and looks like an attempt to dodge review).
- Do not claim a pull request may merge unless the tool returned `pass`. On Free and Standard workspaces the check is
  advisory (the Merge button stays enabled); say "the gate passes" rather than "you can merge" when unsure of the plan.
- Do not paraphrase rule numbers: keep the `§2.1` form so the user can grep the policy file.
