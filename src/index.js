// Merge Gate Explainer: the Jira-side Rovo agent for Merge Policy Gate.
//
// One Forge app cannot hold Bitbucket workspace scopes and Jira site scopes at the same time, so the merge check
// lives in the Bitbucket app (merge-policy-gate) and this app, installed on the Jira site, reads verdicts from
// that app's verdict-feed web trigger. The feed carries nothing secret: a verdict is already visible to anyone who
// can open the pull request.
import { fetch } from "@forge/api";
import { kvs } from "@forge/kvs";
import { RULES, unblockHint, policyTemplateText, DEFAULT_POLICY } from "./rules.js";

const FEED_KEY = "gate:feedUrl";

/** Action: remember the verdict feed URL of the gate installation. */
export async function connectGate(payload) {
  const url = String(payload.feedUrl || "").trim();
  if (!/^https:\/\/[a-z0-9.-]+\.hello\.atlassian-dev\.net\//i.test(url)) {
    return "That does not look like a Forge web trigger URL. It should start with https:// and contain hello.atlassian-dev.net. Run `forge webtrigger list` in the merge-policy-gate app to get it.";
  }
  await kvs.set(FEED_KEY, url);
  return `Connected. I will read verdicts from the gate at ${new URL(url).host}. Ask me about a pull request, for example "why is pull request 2 in hanvigo-dev/gate-demo held?".`;
}

async function feedUrl() {
  return (await kvs.get(FEED_KEY)) || "";
}

async function callFeed(params) {
  const base = await feedUrl();
  if (!base) return { error: "not connected" };
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

const NOT_CONNECTED =
  "This site is not connected to a Merge Policy Gate yet. Paste the verdict feed URL (from `forge webtrigger list` in the merge-policy-gate app) and I will connect it.";

/** Action: live evaluation through the gate. */
export async function explainPullRequest(payload) {
  const { workspace, repository, pullRequestId } = payload;
  if (!workspace || !repository || !pullRequestId) return "I need the workspace, the repository and the pull request number.";
  const r = await callFeed({ workspace, repository, pr: pullRequestId, live: "1" });
  if (r.error === "not connected") return NOT_CONNECTED;
  if (r.status !== 200) return `The gate could not evaluate ${workspace}/${repository}#${pullRequestId}: ${r.body?.error || r.status}.`;
  return present(r.body);
}

/** Action: the verdict stored by the merge check at its last run. */
export async function storedVerdict(payload) {
  const { workspace, repository, pullRequestId } = payload;
  if (!workspace || !repository || !pullRequestId) return "I need the workspace, the repository and the pull request number.";
  const r = await callFeed({ workspace, repository, pr: pullRequestId });
  if (r.error === "not connected") return NOT_CONNECTED;
  if (r.status === 404) return `The merge check has not stored a verdict for ${workspace}/${repository}#${pullRequestId} yet. Ask me to evaluate it now.`;
  if (r.status !== 200) return `The gate answered ${r.status}: ${r.body?.error || ""}.`;
  return present(r.body);
}

function present(rec) {
  return {
    verdict: rec.allowed ? "pass" : "held",
    pullRequest: `${rec.workspace}/${rec.repo}#${rec.prId}`,
    title: rec.title,
    evaluatedAt: rec.evaluatedAt,
    policySource: rec.policySource,
    reasons: rec.reasons,
    rulesCited: rec.rules,
    facts: rec.facts,
    howToUnblock: rec.allowed ? [] : (rec.violated || []).map((r) => `${r}: ${unblockHint(r)}`),
  };
}

/** Action: explain one rule. */
export async function explainRule(payload) {
  const m = /(\d+)\.(\d+)/.exec(String(payload.ruleId || ""));
  const id = m ? `§${m[1]}.${m[2]}` : String(payload.ruleId || "");
  const text = RULES[id];
  if (!text) return { known: Object.keys(RULES), message: `I do not know rule ${payload.ruleId}.` };
  return { rule: id, text, unblock: unblockHint(id) };
}

/** Action: the starter policy file. */
export async function policyTemplate(payload) {
  if (String(payload?.format || "").toLowerCase() === "json") return { path: "MERGE-POLICY.md", defaults: DEFAULT_POLICY };
  return { path: "MERGE-POLICY.md", content: policyTemplateText() };
}
