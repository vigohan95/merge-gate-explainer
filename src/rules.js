// Rule texts, unblock hints and the starter policy. Kept identical to merge-policy-gate/src/policy.js
// (the Bitbucket app) so both apps describe the same contract.

export const RULES = Object.freeze({
  "§2.1": "Protected paths (CI config, Dockerfiles, the policy itself) are never merged without a human approval.",
  "§2.2": "Dependency files may change automatically only for patch or minor bumps; major bumps, added and removed packages need a human approval.",
  "§3.4": "Size limits: at most max_changed_lines changed lines and max_changed_files changed files.",
  "§3.5": "Draft pull requests do not merge.",
  "§3.6": "A human approval is an Approved review from someone other than the author.",
  "§4.1": "The linked Jira work item (key in the branch name or title) must be present, and in an allowed status when statuses are configured.",
  "§5.1": "Every verdict cites the rules it relied on, so a reviewer can see why the gate decided.",
});

export function unblockHint(rule) {
  switch (rule) {
    case "§2.1":
      return "Ask a reviewer who is not the author to approve the pull request, or move the change to the protected file into its own reviewed pull request.";
    case "§2.2":
      return "Get a reviewer's approval for the major bump or the added/removed package, or split it from the rest of the change.";
    case "§3.4":
      return "Split the pull request so each part stays under the size limits, or raise the limits in MERGE-POLICY.md on the destination branch.";
    case "§3.5":
      return "Mark the pull request as ready for review (not a draft).";
    case "§4.1":
      return "Put the Jira key in the branch name or title, or adjust jira_required / jira_allowed_statuses in MERGE-POLICY.md.";
    default:
      return "See MERGE-POLICY.md on the destination branch.";
  }
}

export const DEFAULT_POLICY = Object.freeze({
  version: 1,
  protected_paths: ["Dockerfile", ".dockerignore", "bitbucket-pipelines.yml", ".github/**", "MERGE-POLICY.md", "LICENSE"],
  dependency_files: ["requirements.txt", "requirements-dev.txt", "pyproject.toml", "package.json"],
  dependency_bumps: { auto: ["patch", "minor"], human: ["major", "add", "remove"] },
  limits: { max_changed_lines: 400, max_changed_files: 20 },
  block_drafts: true,
  human_approvals_required: 1,
  jira_allowed_statuses: [],
  jira_required: false,
});

export function policyTemplateText() {
  return `# Merge policy

This file is read by Merge Policy Gate from the destination branch of every pull request.
Edit the block below; the prose above it is for people. Each verdict cites the rule numbers it relied on.

- §2.1 Protected paths are never merged without a human approval.
- §2.2 Dependency files may change automatically only for patch or minor bumps.
- §3.4 Size limits keep automatic merges reviewable.
- §3.5 Drafts do not merge.
- §3.6 A human approval is an Approved review from someone other than the author.
- §4.1 The linked Jira work item key must be in the branch name or title when jira_required is true.

\`\`\`yaml
# merge-policy
protected_paths: ["Dockerfile", ".dockerignore", "bitbucket-pipelines.yml", ".github/**", "MERGE-POLICY.md", "LICENSE"]
dependency_files: ["requirements.txt", "requirements-dev.txt", "pyproject.toml", "package.json"]
dependency_bumps:
  auto: ["patch", "minor"]
  human: ["major", "add", "remove"]
limits:
  max_changed_lines: 400
  max_changed_files: 20
block_drafts: true
human_approvals_required: 1
jira_allowed_statuses: []
jira_required: false
\`\`\`
`;
}
