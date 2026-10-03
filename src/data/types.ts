import type { SkillLevel } from '../content/skills';
import type { WorkflowCategory } from '../content/types';

export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** True for built-in sample records. Demo records never count towards skill evidence. */
  demo?: boolean;
}

// ---------- Work logs ----------

export type LogCategory = WorkflowCategory | 'Other';
export const LOG_CATEGORIES: LogCategory[] = ['Windows', 'Networking', 'Microsoft 365', 'Hardware', 'Printers', 'Cybersecurity', 'Other'];

export type LogStatus = 'resolved' | 'follow-up' | 'unresolved' | 'info';
export const LOG_STATUS_LABEL: Record<LogStatus, string> = {
  resolved: 'Resolved',
  'follow-up': 'Follow-up needed',
  unresolved: 'Unresolved',
  info: 'Information only',
};

export interface ResearchItem {
  id: ID;
  text: string;
  done: boolean;
}

export interface Learning {
  demonstrated: string;
  learned: string;
  concepts: string[];
  toResearch: ResearchItem[];
  nextActivity: string;
}

export interface WorkLog extends BaseRecord {
  /** Human-friendly sequential reference, e.g. WL-2026-0007. */
  ref: string;
  occurredAt: string; // ISO date-time of the work
  client: string;
  device: string;
  category: LogCategory;
  problem: string;
  investigation: string;
  actions: string;
  result: string;
  followUp: string;
  status: LogStatus;
  /** Skill ids (see content/skills.ts). Only skills the user chose to claim. */
  skills: string[];
  learned: string;
  /** Free-text evidence references (ticket link, screenshot filename, etc.). No files are stored. */
  evidence: string;
  ticket: string;
  learning?: Learning;
  sourceSessionId?: ID;
  sourceRunId?: ID;
}

// ---------- Troubleshooting sessions ----------

export type StepState = 'pending' | 'done' | 'skipped' | 'issue';

export interface SessionStep {
  state: StepState;
  note: string;
}

export interface TroubleshootSession extends BaseRecord {
  workflowId: string;
  title: string;
  ticket: string;
  device: string;
  status: 'open' | 'closed';
  /** Keyed by workflow step id. */
  steps: Record<string, SessionStep>;
  /** Initial checks ticked, keyed by index. */
  checks: Record<string, boolean>;
  notes: string;
  /** Decision-tree answers, as human-readable "Prompt → Answer" lines. */
  treePath: string[];
  closedAt?: string;
  workLogId?: ID;
}

// ---------- Checklist runs ----------

export type CheckState = 'unchecked' | 'pass' | 'fail' | 'na';
export const CHECK_STATE_LABEL: Record<CheckState, string> = {
  unchecked: 'Not checked',
  pass: 'Passed',
  fail: 'Failed',
  na: 'Not applicable',
};

export interface ChecklistRun extends BaseRecord {
  templateId: string;
  /** Device label — avoid customer names/serials that are not needed. */
  label: string;
  ticket: string;
  items: Record<string, { state: CheckState; note: string }>;
  status: 'open' | 'complete';
  completedAt?: string;
  workLogId?: ID;
}

// ---------- Knowledge base ----------

export const KB_CATEGORIES = [
  'Commands',
  'Procedures',
  'Troubleshooting',
  'Printers',
  'Networking',
  'Cybersecurity',
  'Microsoft',
  'Lessons learned',
  'References',
] as const;
export type KbCategory = (typeof KB_CATEGORIES)[number];

export interface KbEntry extends BaseRecord {
  title: string;
  category: KbCategory;
  tags: string[];
  /** Plain text. Triple-backtick fences are rendered as code blocks. */
  body: string;
  pinned: boolean;
  lastUsedAt?: string;
  /** Photos and screenshots attached to steps. The image data lives in Files (images/). */
  images?: KbImage[];
}

export interface KbImage {
  path: string;
  /** 0 = the guide in general, otherwise the step number. */
  step: number;
  caption: string;
}

// ---------- Skills ----------

export interface SkillRating extends BaseRecord {
  /** Same as skill id. */
  skillId: string;
  level: SkillLevel | null;
  note: string;
}

// ---------- Usage ----------

export type UsageKind = 'workflow' | 'command' | 'kb' | 'checklist' | 'tool';
export interface UsageEvent extends BaseRecord {
  kind: UsageKind;
  refId: string;
  label: string;
  route: string;
}

// ---------- Progress: tasks, requirements, apprenticeship ----------

export type TaskKind = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'once';
export const TASK_KIND_LABEL: Record<TaskKind, string> = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month', quarterly: 'Every quarter', once: 'One-off' };
/** Columns on the task board. Only one-off tasks sit on the board. */
export type BoardStatus = 'todo' | 'doing' | 'blocked' | 'done';
export const BOARD_LABEL: Record<BoardStatus, string> = { todo: 'To do', doing: 'Doing', blocked: 'Blocked', done: 'Done' };

export interface Task extends BaseRecord {
  title: string;
  kind: TaskKind;
  /** One-off tasks: optional due date, YYYY-MM-DD. */
  due?: string;
  /** Local dates (YYYY-MM-DD) on which it was ticked off. A one-off task is done when this is not empty. */
  doneOn: string[];
  /** Linked requirement id, if it works towards one. */
  requirementId?: ID;
  archived?: boolean;
  /** Board column for one-off tasks. Missing means to do (or done, once ticked). */
  status?: BoardStatus;
}

export type RequirementKind = 'job' | 'apprenticeship';
export const REQUIREMENT_KIND_LABEL: Record<RequirementKind, string> = { job: 'Job requirement', apprenticeship: 'Apprenticeship' };
export type RequirementStatus = 'not-started' | 'in-progress' | 'evidenced' | 'signed-off';
export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  evidenced: 'Evidence gathered',
  'signed-off': 'Signed off',
};

export interface Requirement extends BaseRecord {
  title: string;
  kind: RequirementKind;
  /** Free grouping chosen by the user, e.g. "Knowledge", "Skills", "Behaviours", "Print", "Telecoms". */
  group: string;
  status: RequirementStatus;
  /** Target date, YYYY-MM-DD. */
  target?: string;
  notes: string;
}

export const ACTIVITY_TYPES = ['Study', 'Course or training', 'Mentoring', 'Shadowing', 'Practical work', 'Assessment prep', 'Other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ApprenticeEntry extends BaseRecord {
  /** Local date, YYYY-MM-DD. */
  date: string;
  hours: number;
  activity: ActivityType;
  /** Counts as off-the-job training. */
  offTheJob: boolean;
  title: string;
  whatIDid: string;
  learned: string;
  reflection: string;
  requirementIds: ID[];
}

// ---------- Settings / meta ----------

export interface DashboardLayout {
  order?: string[];
  hidden?: string[];
  sizes?: Record<string, 1 | 2 | 3>;
  titles?: Record<string, string>;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  /** Look: accent colour (#rrggbb), text size, font and corner style. */
  accent?: string;
  textScale?: 'sm' | 'md' | 'lg' | 'xl';
  fontStyle?: 'sans' | 'serif' | 'mono';
  corners?: 'sharp' | 'soft' | 'round';
  /** Replaces the app name in the header and the dashboard greeting. Never put customer details here. */
  appName?: string;
  dashboardTitle?: string;
  /** Dashboard layout: widget order, hidden widgets, sizes (1 to 3 columns wide) and renamed titles. */
  dashboard?: DashboardLayout;
  /** Work-log editor mode. 'auto' = quick on phones, full on desktop. */
  logMode: 'auto' | 'quick' | 'full';
  lastExportAt?: string;
  /** Optional speech-to-text service for uploaded recordings. The API key is never stored. */
  transcribeUrl?: string;
  transcribeModel?: string;
  /** Minutes of inactivity before an encrypted app locks itself. 0 = only when you lock it. */
  autoLockMinutes?: number;
  /** Apprenticeship targets, entered by the user from their own plan. */
  otjWeeklyHours?: number;
  otjTotalHours?: number;
  apprenticeshipStart?: string;
  apprenticeshipEnd?: string;
}

export interface Meta {
  schemaVersion: number;
  seededAt?: string;
  counters: { workLog: number };
}

export const COLLECTIONS = [
  'workLogs',
  'sessions',
  'checklistRuns',
  'kbEntries',
  'skillRatings',
  'usage',
  'tasks',
  'requirements',
  'apprenticeLogs',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export interface CollectionMap {
  workLogs: WorkLog;
  sessions: TroubleshootSession;
  checklistRuns: ChecklistRun;
  kbEntries: KbEntry;
  skillRatings: SkillRating;
  usage: UsageEvent;
  tasks: Task;
  requirements: Requirement;
  apprenticeLogs: ApprenticeEntry;
}

export const SCHEMA_VERSION = 1;
