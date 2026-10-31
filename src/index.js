// Merge Gate Explainer: the Jira-side Rovo agent for Merge Policy Gate.
//
// One Forge app cannot hold Bitbucket workspace scopes and Jira site scopes at the same time, so the merge check
// lives in the Bitbucket app (merge-policy-gate) and this app, installed on the Jira site, reads verdicts from
// that app's verdict-feed web trigger. The feed carries nothing secret: a verdict is already visible to anyone who
// can open the pull request.
import api, { fetch, route } from "@forge/api";
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

// ---- Teamwork Graph: work item -> status + linked pull requests -> gate verdicts -----------------------

// Verified against the live schema (introspection on the demo site, 2026-10-31): there is no `jiraWorkItem` root
// field; objects are fetched by ARI through `objects(ids)` whose `data` is a union, and linked pull requests come
// from the curated `jiraWorkItemLinkedExternalPullRequests`. Operation names must look like `<company>_<operation>`.
const WORK_ITEM_OPERATION = "mpg_workItem";
const WORK_ITEM_QUERY = `query mpg_workItem($id: ID!, $ids: [ID!]!) {
  objects(ids: $ids) { id data { __typename ... on JiraWorkItem { key summary webUrl status { name } assignee { name } } } }
  jiraWorkItemLinkedExternalPullRequests(id: $id, first: 25) {
    edges { node { __typename ... on ExternalPullRequest { displayId title url status lastUpdatedAt provider { name } reviewers { approvalStatus } } } }
    pageInfo { hasNextPage }
  }
}`;

async function cloudIdFrom(context) {
  if (context?.cloudId) return context.cloudId;
  const m = /ari:cloud:jira::site\/([0-9a-f-]+)/i.exec(String(context?.installContext || ""));
  if (m) return m[1];
  const res = await api.asApp().requestJira(route`/_edge/tenant_info`);
  return res.ok ? (await res.json()).cloudId : null;
}

/** Read the work item from the Teamwork Graph; as the user first (what they may see), then as the app. */
async function graphWorkItem(ari) {
  const errors = [];
  for (const who of ["asUser", "asApp"]) {
    try {
      const res = await api[who]().requestTeamworkGraph(WORK_ITEM_QUERY, { id: ari, ids: [ari] }, WORK_ITEM_OPERATION);
      const body = await res.json();
      const item = (body?.data?.objects || []).map((o) => o?.data).find((d) => d?.__typename === "JiraWorkItem");
      if (item) return { data: { ...body.data, jiraWorkItem: item }, via: who, errors: body.errors || [] };
      errors.push(`${who}: ${res.status} ${JSON.stringify(body?.errors || body).slice(0, 300)}`);
    } catch (e) {
      errors.push(`${who}: ${String(e.message || e).slice(0, 300)}`);
    }
  }
  return { data: null, via: null, errors };
}

/** Action: everything the gate and the graph know about one Jira work item. */
export async function workItemPullRequests(payload, context) {
  const key = String(payload.issueKey || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,9}-\d+$/.test(key)) return "I need a Jira work item key, for example KAN-3.";

  // 1. Jira REST gives the numeric id (needed for the ARI) and a fallback status.
  const issueRes = await api.asApp().requestJira(route`/rest/api/3/issue/${key}?fields=status,summary,assignee`);
  if (issueRes.status === 404) return `There is no work item ${key} on this site, or the app cannot see it.`;
  if (!issueRes.ok) return `Jira answered ${issueRes.status} for ${key}.`;
  const issue = await issueRes.json();
  const cloudId = await cloudIdFrom(context);
  const ari = cloudId ? `ari:cloud:jira:${cloudId}:issue/${issue.id}` : null;

  // 2. Teamwork Graph: current status and the pull requests linked to the work item (any connected tool).
  const graph = ari ? await graphWorkItem(ari) : { data: null, via: null, errors: ["no cloudId in context"] };
  const g = graph.data?.jiraWorkItem;
  const status = g?.status?.name || issue.fields?.status?.name || null;
  const linked = (graph.data?.jiraWorkItemLinkedExternalPullRequests?.edges || [])
    .map((e) => e.node)
    .filter(Boolean)
    .map((n) => ({
      number: n.displayId,
      title: n.title,
      url: n.url,
      state: n.status,
      provider: n.provider?.name,
      approvals: (n.reviewers || []).filter((r) => r.approvalStatus === "APPROVED").length,
      lastUpdatedAt: n.lastUpdatedAt,
    }));

  // 3. The gate: every pull request it evaluated for this key, re-checked against the current status so §4.1
  //    (jira_allowed_statuses) is applied with the real work item state rather than skipped.
  const feed = await callFeed({ jira: key });
  let gateKnown = [];
  let gateNote = null;
  if (feed.error === "not connected") gateNote = NOT_CONNECTED;
  else if (feed.status !== 200) gateNote = `The gate answered ${feed.status}: ${feed.body?.error || ""}`;
  else gateKnown = feed.body?.pullRequests || [];
  const verdicts = [];
  for (const rec of gateKnown.slice(0, 5)) {
    let fresh = rec;
    if (status && rec.workspace && rec.repo && rec.prId) {
      const r = await callFeed({ workspace: rec.workspace, repository: rec.repo, pr: rec.prId, live: "1", jiraStatus: status });
      if (r.status === 200) fresh = r.body;
    }
    verdicts.push({
      pullRequest: `${fresh.workspace}/${fresh.repo}#${fresh.prId}`,
      title: fresh.title,
      verdict: fresh.allowed ? "pass" : "held",
      reasons: fresh.reasons || [],
      rulesCited: fresh.rules || [],
      evaluatedAt: fresh.evaluatedAt,
      howToUnblock: fresh.allowed ? [] : (fresh.violated || []).map((r) => `${r}: ${unblockHint(r)}`),
    });
  }

  return {
    workItem: {
      key,
      summary: g?.summary || issue.fields?.summary || null,
      status,
      assignee: g?.assignee?.name || issue.fields?.assignee?.displayName || null,
      url: g?.webUrl || null,
      statusSource: g ? `teamwork-graph (${graph.via})` : "jira-rest",
    },
    linkedPullRequestsInGraph: linked,
    graphNotes: graph.errors.length && !g ? graph.errors : undefined,
    gateVerdicts: verdicts,
    gateNote: gateNote || undefined,
    summary: verdicts.length
      ? `${key} is ${status || "in an unknown status"}; ${verdicts.filter((v) => v.verdict === "held").length} of ${verdicts.length} evaluated pull request(s) held.`
      : `${key} is ${status || "in an unknown status"}; the gate has not evaluated any pull request for it yet.`,
  };
}
