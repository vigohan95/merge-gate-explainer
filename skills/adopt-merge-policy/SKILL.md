---
name: adopt-merge-policy
description: Help a team opt a Bitbucket Cloud repository into Merge Policy Gate by writing its first MERGE-POLICY.md and choosing sensible limits. Use when someone asks how to set up, configure, enable or tune the gate, what the defaults are, which paths to protect, or how to make dependency bumps merge automatically.
compatibility: Works without a gate connection for the template; a connected gate is needed to dry-run a pull request afterwards.
allowed-tools: policy-template explain-rule explain-pull-request
---

# Adopt a merge policy

Merge Policy Gate reads `MERGE-POLICY.md` from the destination branch of every pull request. Until that file exists the
gate runs with built-in defaults and verdicts say `policy=default`. Adoption is one reviewed pull request that adds the
file to the default branch.

## Steps

1. Call `policy-template` and show the returned `content` in a Markdown code block, unchanged.
2. Ask what kind of traffic the repository gets and tune three keys, in this order:
   - `protected_paths`: anything that changes how code is built or deployed (CI files, Dockerfiles, Terraform, the
     policy file itself). Suggest adding `infra/**` or `deploy/**` if they mention them.
   - `limits.max_changed_lines` / `max_changed_files`: start at the defaults (400 / 20). Teams with generated code
     (lockfiles, snapshots) should route those paths through review instead of raising the limits.
   - `jira_required`: `true` only when every branch already carries a key; otherwise the first week will be red.
3. Explain the dependency split in one sentence: patch and minor bumps merge on their own (§2.2 `auto`), majors and
   added or removed packages wait for a human (`human`). This is the rule that lets Dependabot and Renovate traffic flow.
4. Tell them where it lives: commit the file as `MERGE-POLICY.md` at the repository root on the default branch, then
   open **Repository settings, Merge checks** and enable *Merge Policy Gate* (on Premium it can be marked Required;
   on Free and Standard it is advisory and shows the verdict on the pull request).
5. Offer a dry run: once the file is merged, name any open pull request and call `explain-pull-request` to show the
   first verdict with `policy=MERGE-POLICY.md`.

## Answering questions about a rule

For "what does §X.Y mean" call `explain-rule` and answer in two or three sentences: what it checks, what releases it,
which policy key changes it.

## Boundaries

- Never propose loosening the policy from a pull request's own branch; the gate reads the destination branch.
- Do not promise that the check blocks merges on Free and Standard plans; say it is advisory there.
- Keep the YAML keys exactly as in the template; the gate ignores unknown keys silently.
