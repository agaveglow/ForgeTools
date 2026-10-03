import type { SkillDef } from './types';

/** Skill taxonomy. ids are referenced by workflows, work logs and the skills profile. */
export const SKILLS: SkillDef[] = [
  // IT Engineering
  { id: 'hardware', name: 'Hardware', group: 'IT Engineering', description: 'PC, storage, memory, power, displays and peripherals.' },
  { id: 'windows', name: 'Windows', group: 'IT Engineering', description: 'Windows client administration, servicing and repair.' },
  { id: 'networking', name: 'Networking', group: 'IT Engineering', description: 'TCP/IP, DNS, DHCP, Wi-Fi, VPN and connectivity diagnosis.' },
  { id: 'm365', name: 'Microsoft 365', group: 'IT Engineering', description: 'Outlook, Teams, SharePoint, OneDrive and tenant-level access.' },
  { id: 'troubleshooting', name: 'Troubleshooting', group: 'IT Engineering', description: 'Structured fault isolation: hypothesis, test, narrow, fix, verify.' },
  { id: 'documentation', name: 'Documentation', group: 'IT Engineering', description: 'Clear tickets, work records, runbooks and handover notes.' },
  { id: 'customer-support', name: 'Customer support', group: 'IT Engineering', description: 'Service delivery to end users and clients.' },
  { id: 'printer-engineering', name: 'Printer engineering', group: 'IT Engineering', description: 'Print devices, paper paths, consumables, drivers and print services.' },
  { id: 'automation', name: 'Automation', group: 'IT Engineering', description: 'Scripting and repeatable tooling for routine tasks.' },
  // Cybersecurity
  { id: 'network-security', name: 'Network security', group: 'Cybersecurity', description: 'Firewalls, segmentation, VPN security and traffic analysis.' },
  { id: 'endpoint-security', name: 'Endpoint security', group: 'Cybersecurity', description: 'Defender/EDR, patching, hardening, encryption, Secure Boot.' },
  { id: 'identity-access', name: 'Identity and access', group: 'Cybersecurity', description: 'Accounts, MFA, permissions, least privilege, local admin control.' },
  { id: 'vuln-awareness', name: 'Vulnerability awareness', group: 'Cybersecurity', description: 'Recognising outdated software, misconfiguration and exposure.' },
  { id: 'incident-response', name: 'Incident response', group: 'Cybersecurity', description: 'Triage, containment, escalation and evidence handling.' },
  { id: 'security-monitoring', name: 'Security monitoring', group: 'Cybersecurity', description: 'Logs, alerts and baseline vs anomaly.' },
  { id: 'web-security', name: 'Web security', group: 'Cybersecurity', description: 'Browsers, TLS, phishing and web application risk.' },
  { id: 'cryptography', name: 'Cryptography', group: 'Cybersecurity', description: 'Encryption, hashing, certificates and key handling.' },
  // Professional
  { id: 'communication', name: 'Communication', group: 'Professional', description: 'Clear written and spoken updates to technical and non-technical people.' },
  { id: 'problem-solving', name: 'Problem solving', group: 'Professional', description: 'Breaking down unfamiliar problems and choosing a sensible approach.' },
  { id: 'investigation', name: 'Investigation', group: 'Professional', description: 'Gathering evidence methodically before acting.' },
  { id: 'customer-interaction', name: 'Customer interaction', group: 'Professional', description: 'Setting expectations, listening, and handling difficult conversations.' },
  { id: 'time-management', name: 'Time management', group: 'Professional', description: 'Prioritising, estimating and managing a queue.' },
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const SKILL_LEVELS = ['Exposure', 'Developing', 'Practised', 'Confident', 'Demonstrated'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_HELP: Record<SkillLevel, string> = {
  Exposure: 'Seen or tried it, with guidance or once.',
  Developing: 'Done it a few times; still need references or help.',
  Practised: 'Done it repeatedly and can work mostly independently.',
  Confident: 'Reliable across varied situations; can explain why.',
  Demonstrated: 'Confident, with documented evidence (tickets, logs, sign-off) to back it up.',
};
