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
  /** Optional evidence link, for example the video that was watched. */
  link?: string;
  /** Aptem "Type of activity". Older entries do not have it. */
  aptemType?: 'otj' | 'engmaths' | 'other';
  /** Aptem "When did this activity take place?" */
  when?: 'paid' | 'own-paid' | 'own-toil';
  /** Exact minutes spent. `hours` is kept in step with it for the totals. */
  minutes?: number;
  /** Aptem learning plan component, as named in Aptem. */
  component?: string;
  /** Where the entry is in Aptem, as set by the person. ForgeTools cannot see Aptem. */
  aptemStatus?: 'to-enter' | 'submitted' | 'accepted' | 'rejected' | 'resubmitted';
  /** A Harvard-style reference for the source (for example a video), ready to copy. */
  reference?: string;
}

// ---------- Live notes (paper trail) ----------

export type NoteTag = 'note' | 'tried' | 'found' | 'fixed' | 'next' | 'caution';
export const NOTE_TAG_LABEL: Record<NoteTag, string> = { note: 'Note', tried: 'Tried', found: 'Found', fixed: 'Fixed', next: 'Next', caution: 'Caution' };

/** One timestamped line. Text is cleaned of names, numbers and secrets before it is stored. */
export interface JobNoteLine { id: string; at: string; text: string; tag: NoteTag }

/** A running note for one job. A neutral title only, never a customer name. */
export interface JobNote extends BaseRecord {
  title: string;
  status: 'open' | 'closed';
  startedAt: string;
  endedAt?: string;
  lines: JobNoteLine[];
}

// ---------- Settings / meta ----------

export interface DashboardLayout {
  order?: string[];
  hidden?: string[];
  sizes?: Record<string, 1 | 2 | 3>;
  titles?: Record<string, string>;
}

/** A card the person made themselves. Content is scanned like everything else, so keep it free of customer details. */
export type CustomWidgetType = 'note' | 'checklist' | 'counter' | 'progress' | 'countdown' | 'links';
export interface CustomWidget {
  id: string;
  type: CustomWidgetType;
  title: string;
  /** note */
  text?: string;
  /** checklist */
  items?: Array<{ id: string; text: string; done: boolean }>;
  /** counter and progress: current value */
  value?: number;
  /** counter: amount per tap. progress: the goal. */
  step?: number;
  target?: number;
  unit?: string;
  /** countdown: YYYY-MM-DD and what it counts down to */
  date?: string;
  /** links: app routes such as /tasks */
  links?: string[];
  /** Colour of the card's edge and tint (#rrggbb). Unset = the app accent. */
  color?: string;
  /** Show this card on the Glance home screen. */
  glance?: boolean;
}

/** A bubble on the Glance home screen. When none are saved the built-in set is used. */
export interface GlanceAppSetting { id: string; label: string; to: string; icon: string; color?: string }

/** One general daily job. 'job' is ticked once a day. 'watch' is something to keep checking, with a reminder interval. */
export interface DailyJob {
  id: string;
  text: string;
  kind: 'job' | 'watch';
  /** Watch items only: minutes between checks. */
  everyMin?: number;
  /** Job items only: record the time it was ticked (for clocking in and out). */
  stamp?: boolean;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  /** Overall look. Terminal (green screen, animated patterns) is the default. */
  skin?: 'terminal' | 'classic';
  /** False keeps the terminal look still. Default on. */
  motion?: boolean;
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
  /** Home screen style: a calm glanceable watch-style view, or every widget. */
  dashboardView?: 'glance' | 'full';
  customWidgets?: CustomWidget[];
  /** Glance bubbles as the person arranged them, and the colours of its three rings. */
  glanceApps?: GlanceAppSetting[];
  glanceRings?: Partial<Record<'jobs' | 'checks' | 'week', string>>;
  /** The user's own general daily jobs (clock in, watching the inbox and ticket queue, clock out...). */
  dailyJobs?: DailyJob[];
  /** The learning plan components as named in Aptem (the person's own list). */
  aptemComponents?: string[];
  /** Work-log editor mode. 'auto' = quick on phones, full on desktop. */
  logMode: 'auto' | 'quick' | 'full';
  lastExportAt?: string;
  /** Optional speech-to-text service for uploaded recordings. The API key is never stored. */
  transcribeUrl?: string;
  transcribeModel?: string;
  /** Minutes of inactivity before an encrypted app locks itself. 0 = only when you lock it. */
  autoLockMinutes?: number;
  /** Cover the screen when the app is in the background so task switchers show nothing. Default on. */
  privacyShield?: boolean;
  /** Phone app: keep an encrypted copy of your data in a folder you chose. Only the folder's name is kept here. */
  folderBackup?: { name: string };
  /** Hide the 'turn on encryption' reminder until this time (ISO). */
  nudgeUntil?: string;
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
  'jobNotes',
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
  jobNotes: JobNote;
}

export const SCHEMA_VERSION = 1;
