/**
 * Static reference content (shipped with the app, not user data).
 * User-created equivalents (custom runbooks, extra KB entries) live in the data layer.
 */

// ---------- Commands ----------

export type CommandGroup =
  | 'Networking'
  | 'Windows'
  | 'Users & Access'
  | 'Disk & Storage'
  | 'Security'
  | 'Printing'
  | 'Microsoft 365';

export type Shell = 'cmd' | 'powershell' | 'both';

/** safe = read-only/no lasting effect; caution = changes state but reversible/low impact; destructive = can lose data or disrupt the user. */
export type Risk = 'safe' | 'caution' | 'destructive';

export interface CommandEntry {
  /** kebab-case, unique, e.g. "ipconfig-all". Referenced by workflow steps. */
  id: string;
  group: CommandGroup;
  /** Display name, usually the command itself: "ipconfig /all". */
  name: string;
  shell: Shell;
  /** Generic syntax with placeholders: "ping <host> [-t] [-n <count>]". */
  syntax: string;
  /** One-line purpose. */
  purpose: string;
  /** A realistic copy-pasteable example (no real customer data). */
  example: string;
  /** What it actually does, in a few sentences. */
  explanation: string;
  /** What good and bad output looks like. */
  expectedOutput: string;
  /** Situations where this is the right tool. */
  whenToUse: string;
  /** Plain statement of risks/cautions. For safe commands say so (e.g. "Read-only."). */
  risks: string;
  risk: Risk;
  /** True if it needs an elevated (Administrator) prompt to work properly. */
  needsAdmin: boolean;
  /** Other command ids worth reaching for next. */
  related?: string[];
  /** Extra search terms. */
  keywords?: string[];
}

// ---------- Troubleshooting workflows ----------

export type WorkflowCategory =
  | 'Windows'
  | 'Networking'
  | 'Microsoft 365'
  | 'Hardware'
  | 'Printers'
  | 'Cybersecurity';

export interface WorkflowStep {
  /** Unique within the workflow: "s1", "s2"... */
  id: string;
  title: string;
  /** What to do, concretely. */
  detail: string;
  /** Command ids (from commands.ts) relevant to this step. */
  commandIds?: string[];
  /** What to look for in the output / on the device. */
  lookFor?: string;
  /** What the result might indicate. */
  meaning?: string;
  /** What to do next if the result is abnormal. */
  ifAbnormal?: string;
}

export interface Cause {
  cause: string;
  /** What evidence points to this cause. */
  indicators: string;
}

export interface Remediation {
  title: string;
  detail: string;
  /** Data-loss / disruption / authorisation warning, where relevant. */
  caution?: string;
  /** Command ids (from commands.ts) used by this remediation. */
  commandIds?: string[];
}

export interface DecisionOption {
  label: string;
  /** Id of the next node. */
  next?: string;
  /** If set, this option ends the walk with a conclusion (text). */
  conclusion?: string;
}

export interface DecisionNode {
  id: string;
  prompt: string;
  help?: string;
  options: DecisionOption[];
}

export interface DecisionTree {
  start: string;
  nodes: DecisionNode[];
}

export interface Workflow {
  /** Unique, prefixed by area: "win-slow-computer". */
  id: string;
  category: WorkflowCategory;
  title: string;
  /** One or two sentences. */
  summary: string;
  tags: string[];
  /** 1. Symptoms */
  symptoms: string[];
  /** 2. Initial checks (quick, before deeper diagnosis). */
  initialChecks: string[];
  /** 3-5. Diagnostic steps, with commands and what results mean. */
  steps: WorkflowStep[];
  /** 6. Possible causes. */
  causes: Cause[];
  /** 7. Remediation. */
  remediation: Remediation[];
  /** 8. Verification. */
  verification: string[];
  /** 9. Documentation prompts: what to record. */
  documentation: string[];
  /** Skill ids (see skills.ts) this kind of work demonstrates. */
  skills: string[];
  /** Optional guided "what next?" walk-through. */
  tree?: DecisionTree;
}

// ---------- Security checklist template ----------

export interface ChecklistItemTemplate {
  id: string;
  title: string;
  /** How to check it. */
  how: string;
  /** What "Passed" looks like. */
  passWhen: string;
  commandIds?: string[];
}

export interface ChecklistSectionTemplate {
  id: string;
  title: string;
  intro?: string;
  items: ChecklistItemTemplate[];
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  description: string;
  sections: ChecklistSectionTemplate[];
}

// ---------- Skills ----------

export interface SkillDef {
  id: string;
  name: string;
  group: 'IT Engineering' | 'Cybersecurity' | 'Professional';
  description: string;
}
