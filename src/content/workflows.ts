import type { Workflow, WorkflowCategory } from './types';
import { WINDOWS_HARDWARE_WORKFLOWS } from './workflows/windows-hardware';
import { NETWORK_PRINTER_WORKFLOWS } from './workflows/network-printers';
import { M365_SECURITY_WORKFLOWS } from './workflows/m365-security';
import { IDENTITY_SECURITY_WORKFLOWS } from './workflows/identity-security';

export const WORKFLOWS: Workflow[] = [
  ...WINDOWS_HARDWARE_WORKFLOWS,
  ...NETWORK_PRINTER_WORKFLOWS,
  ...M365_SECURITY_WORKFLOWS,
  ...IDENTITY_SECURITY_WORKFLOWS,
];

export const WORKFLOW_BY_ID: Record<string, Workflow> = Object.fromEntries(WORKFLOWS.map((w) => [w.id, w]));

export const WORKFLOW_CATEGORIES: WorkflowCategory[] = ['Windows', 'Networking', 'Microsoft 365', 'Hardware', 'Printers', 'Cybersecurity'];
