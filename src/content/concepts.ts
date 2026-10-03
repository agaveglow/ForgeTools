import type { LogCategory } from '../data/types';

/** Learning prompts per category. These are SUGGESTIONS to research, never statements of what the user knows. */
export interface ConceptSet {
  concepts: string[];
  research: string[];
  nextActivity: string;
}

export const CONCEPTS: Record<LogCategory, ConceptSet> = {
  Printers: {
    concepts: ['Paper path and feed rollers', 'Media type and tray settings', 'Fuser operation', 'Print spooler and queues'],
    research: ['How feed and separation rollers wear and how that shows up as misfeeds', 'Where to find the manufacturer service manual or error-code list', 'How a print job moves from app to spooler to device'],
    nextActivity: 'Look up the error codes for this model and read the paper-path section of its service documentation.',
  },
  Networking: {
    concepts: ['IP addressing and DHCP', 'DNS resolution order', 'Default gateway and routing', 'Layered troubleshooting (link, IP, DNS, application)'],
    research: ['What each field in ipconfig /all means', 'How to tell a DNS fault from a connectivity fault', 'How VPN split tunnelling changes routing'],
    nextActivity: 'Run ipconfig /all, nslookup and tracert on a working machine and note what normal looks like.',
  },
  'Microsoft 365': {
    concepts: ['Mailbox permissions: Full Access, Send As, Send on Behalf', 'Outlook profiles and cached mode', 'Entra ID sign-in and MFA', 'Permission propagation delay'],
    research: ['Difference between Full Access and Send As', 'How auto-mapping works and when it fails', 'How conditional access can block a sign-in'],
    nextActivity: 'Compare the same mailbox in Outlook desktop and Outlook on the web to practise isolating client from account issues.',
  },
  Cybersecurity: {
    concepts: ['Least privilege', 'Endpoint protection status', 'Disk encryption and recovery keys', 'Change control and evidence'],
    research: ['How Secure Boot and BitLocker relate', 'What a Defender alert contains and how to triage it', 'Why local administrator rights are risky'],
    nextActivity: 'Review one device against the security checklist and write up what passed, failed and why.',
  },
  Hardware: {
    concepts: ['Fault isolation by swapping known-good parts', 'Power and thermal basics', 'Storage health indicators'],
    research: ['How to read SMART data', 'Common causes of intermittent power faults'],
    nextActivity: 'Practise isolating a fault by changing one thing at a time and recording the result.',
  },
  Windows: {
    concepts: ['Task Manager and Resource Monitor', 'Event Viewer logs', 'Windows servicing and updates', 'System file integrity (SFC / DISM)'],
    research: ['How to read a stop code and Event Viewer entry', 'What startup items do and how to review them', 'When SFC and DISM help and when they do not'],
    nextActivity: 'Open Event Viewer on a healthy PC and learn the difference between normal and abnormal entries.',
  },
  Other: {
    concepts: ['Structured troubleshooting', 'Clear documentation'],
    research: ['How to write a problem statement that someone else can act on'],
    nextActivity: 'Rewrite one recent log so a colleague could repeat your steps.',
  },
};
