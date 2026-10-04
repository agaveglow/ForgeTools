/** Generic kit and pre-visit checklists. Users can add their own items; these are starting points only. */
export interface KitList { id: string; title: string; intro: string; items: string[] }

export const KIT_LISTS: KitList[] = [
  { id: 'tools', title: 'Hand tools and test gear', intro: 'What to have on you for hardware and cabling jobs.', items: [
    'Screwdriver set (precision and standard), Torx bits',
    'Cable tester (RJ45 and RJ11)',
    'Crimp tool, RJ45 plugs and boots, punch-down tool',
    'Cable cutters, strippers and a small knife',
    'Network patch leads in a few lengths, a short crossover lead',
    'Spare USB, HDMI, DisplayPort and power leads',
    'Cable ties and hook-and-loop straps, labels and a marker',
    'Torch or head torch, a small mirror',
    'Anti-static strap, lint-free cloths, isopropyl wipes, compressed air',
    'Gloves and a small bag for waste toner and old parts',
    'Spare batteries and a power bank',
  ] },
  { id: 'print', title: 'Printer and copier spares', intro: 'Common consumables and parts worth carrying.', items: [
    'Toner for the models you support most',
    'Waste toner bottles',
    'Feed, pick-up and separation rollers for common models',
    'Fuser cleaning cloths and a spare drum or developer if you stock them',
    'Spare staples and staple cartridges',
    'Test pages and a test chart',
    'USB stick for firmware and drivers (check it is clean and labelled)',
    'Service-manual access on your phone or tablet, downloaded for offline use',
  ] },
  { id: 'it', title: 'IT and software kit', intro: 'The digital side.', items: [
    'Laptop or tablet, charged, with the charger',
    'Bootable USB with the tools your company approves',
    'Approved remote-support tools installed and signed in',
    'Phone charged, mobile data available, hotspot tested',
    'Authenticator app working on your own phone',
    'Approved password vault reachable, no credentials written on paper',
    'Offline copies of the guides you may need (this app works without a signal)',
  ] },
  { id: 'before', title: 'Before you leave for a visit', intro: 'A quick check so you do not need a second trip.', items: [
    'Re-read the ticket and any notes from previous visits',
    'Confirm the time and who will meet you',
    'Check you have the right parts for the model and fault',
    'Check you have the right driver or firmware file for that model',
    'Check you know the escalation contact',
    'Charge your devices and pack the kit lists above',
  ] },
  { id: 'after', title: 'Before you leave a site', intro: 'Leave it tidy and documented.', items: [
    'Test the original fault with the customer',
    'Collect tools, packaging and old parts',
    'Dispose of waste parts and toner correctly',
    'Label anything you changed',
    'Tell the customer what you did and what happens next',
    'Write the ticket note while it is fresh',
  ] },
];
