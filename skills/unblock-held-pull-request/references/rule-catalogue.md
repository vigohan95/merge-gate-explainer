# Merge Policy Gate rule catalogue

Numbers follow the sections of the starter `MERGE-POLICY.md`. Verdicts cite them verbatim.

| Rule | Text | Policy keys | Released by |
|---|---|---|---|
| §2.1 | Protected paths (CI config, Dockerfiles, the policy itself) are never merged without a human approval. | `protected_paths` | an Approved review by a non-author, or removing the protected file from the change |
| §2.2 | Dependency files may change automatically only for patch or minor bumps; major bumps, added and removed packages need a human approval. | `dependency_files`, `dependency_bumps.auto`, `dependency_bumps.human` | an Approved review by a non-author, or splitting the dependency change |
| §3.4 | Size limits: at most `max_changed_lines` changed lines and `max_changed_files` changed files. | `limits.max_changed_lines`, `limits.max_changed_files` | splitting the pull request, or raising the limits on the destination branch |
| §3.5 | Draft pull requests do not merge. | `block_drafts` | marking the pull request ready for review |
| §3.6 | A human approval is an Approved review from someone other than the author. | `human_approvals_required` | more Approved reviews by non-authors |
| §4.1 | The linked Jira work item key must be in the branch name or title when the policy requires it; when statuses are configured the work item must be in one of them. | `jira_required`, `jira_allowed_statuses` | adding the key to the branch or title; transitioning the work item |
| §5.1 | Every verdict cites the rules it relied on. | none | informational |

Facts the gate records with each verdict: `changedFiles`, `changedLines`, `approvalsByOthers`, `draft`, `jira.key`,
`evaluatedAt`, `policySource` (`MERGE-POLICY.md` or `default`).

Built-in defaults (used when the repository has no policy file): protected paths `.github/**`, `bitbucket-pipelines.yml`,
`Dockerfile*`, `MERGE-POLICY.md`; dependency files `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`,
`Cargo.toml`; auto bumps patch + minor; limits 400 lines / 20 files; drafts blocked; 1 human approval for protected
changes; Jira key not required.
