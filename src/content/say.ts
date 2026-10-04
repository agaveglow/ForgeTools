/**
 * Wording for a remote session, to paste into a text window on the user's screen.
 * Original, general wording. {name} {me} {issue} {time} {app} are filled in from the builder;
 * [[ ... ]] is dropped when a placeholder inside it is empty.
 */
export interface Phrase { id: string; stage: string; title: string; friendly: string; brief: string }

export const STAGES = ['Starting the session', 'While I work', 'I need you to', 'Problems and delays', 'Finishing', 'Staying safe'];

export const PHRASES: Phrase[] = [
  { id: 'open-intro', stage: STAGES[0], title: 'Introduce yourself',
    friendly: "Hi {name}, [[it's {me} from IT. ]]I'm connected to your computer to look into {issue}. You'll see the mouse move by itself, that's me. Please don't use the mouse or keyboard unless I ask you to.",
    brief: 'Hi {name}, [[{me} from IT. ]]Connected to look into {issue}. The mouse will move by itself. Please keep hands off unless I ask.' },
  { id: 'ask-time', stage: STAGES[0], title: 'Check it is a good time',
    friendly: "Is now still a good time for this? If you're in the middle of something important, say so and I'll wait or come back later.",
    brief: 'Is now a good time? Say if I should wait.' },
  { id: 'take-control', stage: STAGES[0], title: 'About to take control',
    friendly: "I'm going to take control of the screen now. If you want me to stop at any point, just tell me.",
    brief: 'Taking control now. Tell me to stop at any time.' },
  { id: 'privacy', stage: STAGES[0], title: 'Reassure about privacy',
    friendly: "I'll only open the settings and tools I need for {issue}. I won't open your personal files or emails.",
    brief: "I'll only open what's needed for {issue}, not your files or emails." },

  { id: 'hands-off', stage: STAGES[1], title: 'Please keep hands off',
    friendly: 'Please leave the mouse and keyboard alone for {time} while I work.',
    brief: "Please don't touch the mouse or keyboard for {time}." },
  { id: 'working', stage: STAGES[1], title: 'Still working',
    friendly: 'Still working on {issue}. Nothing needed from you right now.',
    brief: 'Still working. Nothing needed from you.' },
  { id: 'checking', stage: STAGES[1], title: 'Running checks',
    friendly: "I'm running some checks. Windows may open and close and the screen may flicker. That's normal.",
    brief: 'Running checks. Windows may open and close. Normal.' },
  { id: 'admin-tools', stage: STAGES[1], title: 'Opening admin tools',
    friendly: "I'm opening some system tools to look at {issue}. They're standard admin screens, so don't be alarmed by what appears.",
    brief: 'Opening standard admin tools. Nothing to worry about.' },
  { id: 'installing', stage: STAGES[1], title: 'Update or install running',
    friendly: "An update is installing. Please don't switch off, close the lid or unplug anything until it has finished.",
    brief: "Install in progress. Please don't power off or close the lid." },
  { id: 'takes-time', stage: STAGES[1], title: 'Taking longer than expected',
    friendly: "This is taking a bit longer than I expected. I'll update you again in {time}.",
    brief: 'Taking longer than expected. Update in {time}.' },

  { id: 'save-work', stage: STAGES[2], title: 'Save and close work',
    friendly: 'Before I carry on, please save your work and close your documents and programs.',
    brief: 'Please save your work and close your programs.' },
  { id: 'restart', stage: STAGES[2], title: 'Restart needed',
    friendly: "I need to restart your computer. The connection will drop for a few minutes and I'll reconnect once it's back. Please don't switch it off.",
    brief: "Restart needed. Connection drops for a few minutes. I'll reconnect. Please don't power off." },
  { id: 'type-password', stage: STAGES[2], title: 'Type your password yourself',
    friendly: "A sign-in box has appeared. Please type your password yourself. I can't see it and I don't need it.",
    brief: "Please type your password yourself. I don't need it." },
  { id: 'test-it', stage: STAGES[2], title: 'Ask them to test',
    friendly: 'Could you try {app} now and tell me what happens?',
    brief: 'Please try {app} now and tell me what happens.' },
  { id: 'print-test', stage: STAGES[2], title: 'Send a test print',
    friendly: 'Please send a test print and tell me whether it comes out and looks right.',
    brief: 'Please send a test print and tell me how it looks.' },
  { id: 'confirm-fixed', stage: STAGES[2], title: 'Confirm it works',
    friendly: 'Can you confirm everything is working as you expect now?',
    brief: 'Is everything working now?' },

  { id: 'come-back', stage: STAGES[3], title: 'Need to stop for now',
    friendly: "I need to stop here for now. I'll come back to this and let you know when. You can carry on using your computer as normal for the moment.",
    brief: "Stopping for now. I'll come back and let you know when." },
  { id: 'escalate', stage: STAGES[3], title: 'Passing to a specialist',
    friendly: "This needs a specialist. I'm passing it on with everything I've found, so you won't need to explain it again. You'll get an update on your ticket.",
    brief: "Passing this to a specialist with my findings. You'll get a ticket update." },
  { id: 'on-site', stage: STAGES[3], title: 'Needs a visit',
    friendly: "I can't fix this remotely, it needs someone on site. I'll arrange that and put the details on your ticket.",
    brief: "Can't fix remotely. Needs a site visit. Details on your ticket." },
  { id: 'cant-see', stage: STAGES[3], title: 'Cannot see the fault',
    friendly: "I can't see the problem happening at the moment. If it comes back, please note what you were doing and tell us straight away.",
    brief: "Can't see the fault now. If it returns, note what you were doing and tell us." },

  { id: 'closing-fixed', stage: STAGES[4], title: 'Fixed',
    friendly: "That's {issue} sorted. If it happens again, tell us straight away and mention today's visit.",
    brief: 'Sorted. If it returns, tell us and mention today.' },
  { id: 'closing-ticket', stage: STAGES[4], title: 'I will update the ticket',
    friendly: "I'll write up what I did on your ticket. If anything doesn't look right later, reply to it.",
    brief: "I'll note what I did on your ticket. Reply to it if anything looks wrong." },
  { id: 'closing-disconnect', stage: STAGES[4], title: 'Disconnecting',
    friendly: "I'm going to disconnect now. You'll see the remote session banner disappear. Thanks for your patience.",
    brief: "Disconnecting now. Thanks." },
  { id: 'thanks', stage: STAGES[4], title: 'Thank you',
    friendly: 'Thanks for your help, {name}.',
    brief: 'Thanks, {name}.' },

  { id: 'never-password', stage: STAGES[5], title: 'We never ask for your password',
    friendly: 'A reminder: IT will never ask you to tell us your password, by phone, email or chat. If anyone does, let us know.',
    brief: 'IT never asks for your password by phone, email or chat. If anyone does, tell us.' },
  { id: 'suspicious-email', stage: STAGES[5], title: 'Suspicious email',
    friendly: "Please don't click any links or open attachments in that email. Report it the usual way and then delete it.",
    brief: "Don't click links or open attachments. Report it the usual way, then delete it." },
];

/** What the builder offers as "I need you to", in the order they are written. */
export const NEEDS: Array<{ id: string; label: string }> = [
  { id: 'hands-off', label: 'Keep hands off the mouse and keyboard' },
  { id: 'save-work', label: 'Save and close their work' },
  { id: 'restart', label: 'Restart needed' },
  { id: 'type-password', label: 'Type their own password' },
  { id: 'test-it', label: 'Test the application' },
  { id: 'print-test', label: 'Send a test print' },
  { id: 'confirm-fixed', label: 'Confirm it works' },
];

export const CLOSINGS: Array<{ id: string; label: string }> = [
  { id: '', label: 'No closing' },
  { id: 'closing-fixed', label: 'Fixed' },
  { id: 'come-back', label: 'Need to stop for now' },
  { id: 'escalate', label: 'Passing to a specialist' },
  { id: 'on-site', label: 'Needs a site visit' },
  { id: 'cant-see', label: 'Cannot see the fault' },
];
