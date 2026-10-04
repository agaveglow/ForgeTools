/** Daily IT engineer workflow (from the user's own daily walkthrough). Generic working practice: no customer data. */

export interface WorkflowList { id: string; title: string; intro: string; items: string[] }

export const CORE_PRINCIPLE = 'Remain available for incidents while continuously progressing planned work and monitoring the IT environment.';

export const WORKFLOW_LISTS: WorkflowList[] = [
  { id: 'start', title: '1. Start of day: establish control', intro: 'Understand what happened overnight, what needs attention today and whether any system needs immediate action.', items: [
    'Log in and make sure all required IT systems and tools are accessible.',
    'Check the ticketing system for new tickets, updates and overnight activity.',
    'Check email and internal communications for urgent issues or requests.',
    'Review incidents or tickets carried over from the previous day.',
    'Check scheduled maintenance, updates, backups or automated jobs due today.',
    "Review the day's planned tasks and identify anything time-sensitive.",
    'Identify any issue that could affect multiple users or a critical service.',
  ] },
  { id: 'quiet', title: '5. When there are no immediate incidents', intro: 'A quiet period is a chance to reduce future problems, not just wait for the next ticket.', items: [
    'Work through outstanding tickets.',
    'Complete scheduled maintenance and planned tasks.',
    'Follow up on client issues waiting for information or action.',
    'Carry out proactive checks and maintenance.',
    'Update documentation, procedures and troubleshooting notes.',
    'Improve systems, processes and internal organisation.',
    'Complete relevant technical training or apprenticeship learning.',
    'Review upcoming work so deadlines and dependencies are not missed.',
  ] },
  { id: 'incident', title: '6. When an incident occurs', intro: 'Planned work can pause for an incident. When it is resolved or escalated, go back to the previous task so planned work does not disappear.', items: [
    'Assess the impact and urgency.',
    'Identify whether it affects one user, multiple users, a client or a critical service.',
    'Take appropriate troubleshooting or recovery action.',
    'Escalate when the issue is outside your authority, knowledge or available access.',
    'Keep affected users informed where appropriate.',
    'Document the cause, actions taken, result and any follow-up required.',
    'Update the ticket or task status.',
    'Return to the highest-priority outstanding work.',
  ] },
  { id: 'docs', title: '7. Documentation standard', intro: 'Every meaningful piece of work should leave a record that lets another engineer understand it without repeating the investigation.', items: [
    'What was reported?',
    'What was checked?',
    'What actions were taken?',
    'What was the result?',
    'Was it resolved, escalated or left awaiting information?',
    'Is there a follow-up action or deadline?',
    'Has the ticket or task been updated with the latest status?',
  ] },
  { id: 'end', title: '8. End of day: close the loop', intro: 'Leave nothing important hidden overnight.', items: [
    'Check the ticketing system for new or outstanding high-priority issues.',
    'Check monitoring / RMM for active alerts requiring attention.',
    'Review unresolved incidents and confirm their current status.',
    'Update tickets with work completed during the day.',
    'Document anything that needs to continue tomorrow.',
    'Record any issue awaiting another person, supplier or client.',
    'Make sure important outstanding issues are visible to the appropriate person or team.',
    "Review tomorrow's scheduled work and time-sensitive tasks.",
  ] },
];

export const WORKFLOW_PRIORITIES = [
  { level: '1 · Critical', example: 'Major outage, widespread loss of service, serious security incident', action: 'Stop planned work and investigate immediately. Escalate where required.' },
  { level: '2 · High', example: 'User unable to work, important service unavailable, significant client issue', action: 'Address promptly and keep the affected person informed.' },
  { level: '3 · Normal', example: 'Standard support request or individual ticket', action: 'Work through the queue according to urgency and impact.' },
  { level: '4 · Planned', example: 'Documentation, maintenance, improvements, learning', action: 'Complete when operational workload allows.' },
];

export const WORKFLOW_LOOP = [
  { name: 'Work', text: 'Complete the current priority task.' },
  { name: 'Check', text: 'Check for new tickets, alerts or urgent requests.' },
  { name: 'Respond', text: 'Pause planned work when an incident requires attention.' },
  { name: 'Document', text: 'Record the action, outcome and next step.' },
  { name: 'Continue', text: 'Return to the highest-priority outstanding task.' },
];

export const WORKFLOW_MONITOR = [
  { area: 'Ticketing system', look: 'New tickets, updates, unresolved issues, tickets waiting for responses and approaching deadlines.' },
  { area: 'RMM / monitoring', look: 'Offline devices, hardware warnings, software issues, system health and automated alerts.' },
  { area: 'Email / communications', look: 'New support requests, client communications, internal messages and urgent notifications.' },
  { area: 'Network & services', look: 'Reported connectivity problems, service outages, unusual degradation and recurring issues.' },
  { area: 'Backups & automated jobs', look: 'Failed, missed or warning states where these are available to monitor.' },
  { area: 'Security', look: 'Endpoint alerts, suspicious activity, account/security notifications and incidents requiring investigation.' },
  { area: 'Scheduled work', look: 'Updates, installations, maintenance windows, onboarding/offboarding and other planned activity.' },
  { area: 'Users / clients', look: 'Any issue preventing people from working or affecting a business-critical process.' },
  { area: 'Outstanding work', look: 'Tasks that have stalled, need follow-up, are waiting on another person or require escalation.' },
];

export const WORKFLOW_QUICK = [
  { when: 'Arriving', check: 'Tickets, email, alerts, scheduled work', then: 'Identify priorities' },
  { when: 'Starting a task', check: 'Current priority and impact', then: 'Begin work' },
  { when: 'During work', check: 'New tickets / alerts / urgent requests', then: 'Pause and respond if necessary' },
  { when: 'After resolving', check: 'Result and follow-up', then: 'Document and update ticket' },
  { when: 'Quiet period', check: 'Outstanding and planned work', then: 'Progress proactive tasks' },
  { when: 'Before leaving', check: 'Tickets, alerts, unresolved issues', then: 'Document and hand over' },
];
