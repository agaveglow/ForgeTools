/** DNS and mail record reference. Original notes with example.com style documentation names only. */
export const RECORD_TYPES: Array<{ type: string; use: string; example: string; tip: string }> = [
  { type: 'A', use: 'Name to IPv4 address', example: 'www  A  203.0.113.10', tip: 'Several A records for one name share the load' },
  { type: 'AAAA', use: 'Name to IPv6 address', example: 'www  AAAA  2001:db8::10', tip: 'If IPv6 breaks but IPv4 works, check this record' },
  { type: 'CNAME', use: 'Name is an alias of another name', example: 'shop  CNAME  store.example.net.', tip: 'Cannot sit at the root of a domain; cannot share a name with other records' },
  { type: 'MX', use: 'Where mail for the domain goes', example: '@  MX  10  mail.example.net.', tip: 'Lowest number is tried first' },
  { type: 'TXT', use: 'Free text; carries SPF, DKIM, DMARC and ownership proofs', example: '@  TXT  "v=spf1 include:mail.example.net -all"', tip: 'Long values may be split into quoted pieces' },
  { type: 'NS', use: 'Which servers answer for the domain', example: '@  NS  ns1.example.net.', tip: 'Wrong NS at the registrar makes every other record irrelevant' },
  { type: 'SOA', use: 'Zone admin data and the serial number', example: '@  SOA  ns1.example.net. admin.example.net. ...', tip: 'Serial must rise when the zone changes' },
  { type: 'PTR', use: 'IP address back to a name (reverse lookup)', example: '10.113.0.203.in-addr.arpa.  PTR  mail.example.net.', tip: 'Mail servers often check this; set by whoever owns the IP' },
  { type: 'SRV', use: 'Where a service lives, with port', example: '_sip._tcp  SRV  10 60 5060 pbx.example.net.', tip: 'Used by phone systems and some directory sign-ins' },
  { type: 'CAA', use: 'Which authorities may issue certificates', example: '@  CAA  0 issue "ca.example.net"', tip: 'A wrong value blocks certificate renewal' },
];

export const TTL_NOTES: Array<[string, string]> = [
  ['Why TTL matters', 'It is how long others may remember an answer. Changes take up to that long to be seen everywhere.'],
  ['Before a planned change', 'Lower the TTL a day ahead, make the change, then raise it again.'],
  ['Typical values', '300 seconds (5 minutes) while changing; 3600 (1 hour) or more when settled.'],
];

export const SPF_TERMS: Array<[string, string]> = [
  ['v=spf1', 'Marks the record as SPF. Must be first'],
  ['ip4: / ip6:', 'Allow a specific address or range'],
  ['a / mx', 'Allow the addresses of the domain\'s own A or MX records'],
  ['include:', 'Also allow what another domain\'s SPF allows (mail services)'],
  ['-all', 'Reject anything not listed (strict)'],
  ['~all', 'Mark anything not listed as suspect (soft fail)'],
  ['?all', 'No opinion about anything else'],
  ['+all', 'Allow everyone. Defeats the point; never use'],
];

export const DMARC_TAGS: Array<[string, string]> = [
  ['v=DMARC1', 'Marks the record. Must be first'],
  ['p=', 'Policy: none (watch only), quarantine (send to junk), reject (refuse)'],
  ['sp=', 'Policy for subdomains'],
  ['pct=', 'Share of mail the policy applies to, 1 to 100'],
  ['rua=', 'Where daily summary reports go (mailto:)'],
  ['ruf=', 'Where failure reports go'],
  ['adkim= / aspf=', 'r (relaxed) or s (strict) matching of the DKIM and SPF domains'],
];

export const DNS_COMMANDS: Array<[string, string]> = [
  ['Look up an A record', 'nslookup example.com'],
  ['Ask for mail servers', 'nslookup -type=MX example.com'],
  ['Read TXT records (SPF, DMARC)', 'nslookup -type=TXT example.com'],
  ['DMARC record', 'nslookup -type=TXT _dmarc.example.com'],
  ['Ask a specific DNS server', 'nslookup example.com 1.1.1.1'],
  ['PowerShell lookup', 'Resolve-DnsName example.com -Type MX'],
  ['Empty the local DNS cache', 'ipconfig /flushdns'],
  ['Show the local DNS cache', 'ipconfig /displaydns'],
];
