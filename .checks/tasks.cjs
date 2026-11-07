const DAY = 86400000;
const protectedLabels = new Set(['pinned', 'security', 'help wanted', 'good first issue']);
const warning = 'This issue has been automatically marked as **stale** because it has not had any activity in 60 days. It will be closed in 14 days if no further activity occurs. If this issue is still relevant, please leave a comment or remove the `stale` label.';
const closing = 'This issue has been automatically closed due to inactivity. If you believe this issue is still relevant, please feel free to reopen it.';

function labelNames(labels) {
  return (labels || []).map(label => typeof label === 'string' ? label : label.name);
}

function stale(input) {
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) throw new Error('Invalid reference clock');
  const warnings = [], closures = [];
  for (const issue of input.issues) {
    const labels = labelNames(issue.labels);
    if (issue.state !== 'open' || issue.pull_request || labels.some(label => protectedLabels.has(label))) continue;
    const events = issue.timeline || [];
    const activity = Math.max(Date.parse(issue.created_at), ...events.map(event => Date.parse(event.created_at)));
    if (!Number.isFinite(activity)) throw new Error('Invalid activity timestamp');
    if (!labels.includes('stale')) {
      if (now - activity >= 60 * DAY) warnings.push({ issue, activity });
      continue;
    }
    const marked = events.filter(event => event.event === 'labeled' && event.label === 'stale').map(event => Date.parse(event.created_at));
    if (!marked.length) throw new Error('A stale issue requires its label history');
    const labelTime = Math.max(...marked);
    if (now - labelTime >= 14 * DAY && now - activity >= 14 * DAY) closures.push({ issue, activity });
  }
  const oldestFirst = (a, b) => a.activity - b.activity || a.issue.number - b.issue.number;
  warnings.sort(oldestFirst); closures.sort(oldestFirst);
  const actions = [];
  let comments = 0;
  for (const { issue } of warnings) {
    if (comments >= 50) break;
    actions.push({ kind: 'add_labels', issue: issue.number, labels: ['stale'] });
    actions.push({ kind: 'add_comment', issue: issue.number, body: warning });
    comments++;
  }
  for (const { issue } of closures) {
    if (comments >= 50) break;
    actions.push({ kind: 'add_comment', issue: issue.number, body: closing });
    actions.push({ kind: 'close_issue', issue: issue.number });
    comments++;
  }
  return { actions };
}


module.exports = { stale };
