export type HelpCategory =
  | 'getting-started'
  | 'shipments'
  | 'tracking'
  | 'quotes'
  | 'administration';
export interface Guide {
  id: string;
  title: string;
  intro: string;
  screenshot: string;
  steps: { title: string; text: string }[];
  tips: string[];
}
export const categories: { id: HelpCategory; title: string; description: string }[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Find your way around the dashboard.',
  },
  { id: 'shipments', title: 'Shipments', description: 'Add, find and update shipment records.' },
  {
    id: 'tracking',
    title: 'Tracking & Audit',
    description: 'Understand monitoring, lookups and history.',
  },
  {
    id: 'quotes',
    title: 'Quote Compare',
    description: 'Prepare shipping details and compare quotes.',
  },
  {
    id: 'administration',
    title: 'Administration',
    description: 'Manage employee access and reference settings.',
  },
];
export const guides: Record<HelpCategory, Guide[]> = {
  'getting-started': [
    {
      id: 'dashboard',
      title: 'Read your dashboard',
      screenshot: 'overview',
      intro:
        'Start with Overview to see shipment counts and work that needs attention. Select a card or shipment reference to investigate.',
      steps: [
        {
          title: 'Open a shipment view',
          text: 'The count cards open the matching shipment list. Counts reflect the current scope and filters, not just the rows on one page.',
        },
        {
          title: 'Check Needs attention',
          text: 'Review paused shipments, lookup failures and due follow-ups. A failed lookup does not mean the shipment itself failed or is late.',
        },
        {
          title: 'Review upcoming deliveries',
          text: 'See shipments with upcoming estimated delivery dates, then open a record for the latest known details.',
        },
      ],
      tips: [
        'Use Personal for shipments you created and Team for the wider team view. This is different from Sales Rep assignment.',
        'Use the sidebar for navigation; on mobile, open the menu button. Theme, Change password and Sign out are in the account area.',
        'An administrator creates your account. Replace your issued password when prompted. Business timestamps use America/New_York; carrier dates stay date-only.',
      ],
    },
  ],
  shipments: [
    {
      id: 'add-find',
      title: 'Add and find shipments',
      screenshot: 'shipments',
      intro:
        'Open Shipments → Monitoring. Add one tracking reference at a time, or search records already monitored by the team.',
      steps: [
        {
          title: 'Add a shipment',
          text: 'Choose an enabled carrier and enter its tracking reference. PO#, Customer, Vendor, notes, Sales Rep and follow-up date are optional. Select Add shipment to save.',
        },
        {
          title: 'Search and filter',
          text: 'Search matches tracking references, notes, PO#, customers and vendors. Use views and filters to narrow results. Multiple selected Sales Reps match any selected rep.',
        },
        {
          title: 'Read and sort the list',
          text: 'PO# is the second desktop column. Click a sortable heading, or use mobile sort controls. Open the tracking reference for details. Use page controls for more results.',
        },
      ],
      tips: [
        'Unacknowledged tracking updates temporarily appear first across pages within your current tab and filters. Clicking a shipment or marking displayed changes seen returns it to your selected sort. Your default remains Created, newest first. Acknowledgment is specific to your account and browser.',
        'PO#, Customer and Vendor are typed text, limited to 255 characters. Leading zeros and case are preserved. Duplicate PO values are allowed.',
        'Adding an existing carrier/tracking-reference pair opens the existing record without overwriting its saved information.',
        'For a carrier without automated tracking, use Other when enabled and maintain its status and dates manually.',
      ],
    },
    {
      id: 'other',
      title: 'Use the Other shipments tab',
      screenshot: 'other',
      intro:
        'Other is for shipments maintained manually by your team instead of an automated carrier integration. Open Shipments → Monitoring → Other.',
      steps: [
        {
          title: 'Open the Other view',
          text: 'Select Other above the table. On mobile, choose Other in Shipment view. This view lists unfinished manual Other-carrier shipments. Delivered shipments move to Delivered; reopening returns them to Other. It it is not a list of failed or unknown tracking references.',
        },
        {
          title: 'Create a manual shipment',
          text: 'Choose Other as the carrier, enter a tracking reference and any PO#, Customer, Vendor or Sales Rep details, then add the shipment. Other must be enabled by an Admin for new entries.',
        },
        {
          title: 'Maintain status and dates',
          text: 'Choose Pending Pickup, Pickedup, Out for delivery or Delivered. Enter known pickup and delivery dates and set a follow-up date when the team needs to check again. Save later updates in the shipment’s Overview → Manual shipment details.',
        },
      ],
      tips: [
        'Other shipments do not poll a carrier automatically and do not have Refresh, Retry now, Pause or Resume controls. Your team owns status updates.',
        'Due follow-up dates can put these records in Needs attention. The Other view and Needs attention can overlap.',
        'An Admin disabling Other prevents new entries; existing Other shipments remain editable. Use notes to record calls, confirmations and the source of manual updates.',
      ],
    },
    {
      id: 'edit',
      title: 'Update shipment details',
      screenshot: 'details',
      intro:
        'The Overview tab brings the current tracking snapshot, editable shipment details and notes together.',
      steps: [
        {
          title: 'Read the latest known tracking',
          text: 'Check the carrier status, pickup and delivery dates. If a lookup fails, the last known tracking remains visible.',
        },
        {
          title: 'Edit business details',
          text: 'Update PO#, Customer, Vendor, Sales Rep or follow-up date, then save. Clear an optional text field and save to remove its value.',
        },
        {
          title: 'Keep useful notes',
          text: 'Select Edit notes, enter your update, then Save notes. If someone else changes the note, review the warning before replacing it.',
        },
      ],
      tips: [
        'Carrier and tracking reference cannot be corrected through this editor.',
        'Delete shipment removes it from active views and stops monitoring. It is a soft deletion with no restore action in the app; adding the pair again creates a new record.',
        'A future follow-up date can keep delivered shipments monitored until that date starts in New York. Use Monitor again when available to restart monitoring.',
      ],
    },
  ],
  tracking: [
    {
      id: 'audit',
      title: 'Understand monitoring and audit',
      screenshot: 'audit',
      intro:
        'Open a shipment and select Audit for monitoring state, lookup/run information and record attribution.',
      steps: [
        {
          title: 'Understand monitoring state',
          text: 'Active means checks are scheduled. A manual pause stops checks until resumed. Repeated missing or failed lookups can also pause monitoring; use the available Refresh or Retry now action to check again.',
        },
        {
          title: 'Inspect the latest lookup and run',
          text: 'A refresh queues work and may take time. Run success means processing completed; it does not prove a shipment was found or delivered. Your requested refresh appears on this tab.',
        },
        {
          title: 'See record attribution',
          text: 'Shipment audit shows who added or updated the record and when. Record update describes staff edits; database update timestamps may also change during tracking work.',
        },
      ],
      tips: [
        'Use Refresh or Retry now from the shipment actions when available. Disabled carriers and some monitoring states prevent refreshes.',
        'A manually paused shipment resumes only through the permitted action. A failed retry does not automatically prove monitoring recovered.',
        'Other carrier shipments are updated manually and do not show automated lookup/run information.',
      ],
    },
    {
      id: 'history',
      title: 'Review tracking history',
      screenshot: 'history',
      intro:
        'History shows recorded tracking observations so you can compare what changed over time.',
      steps: [
        {
          title: 'Open History',
          text: 'Switch to History on the shipment detail page. Your Overview and Audit tabs remain available.',
        },
        {
          title: 'Compare observations',
          text: 'Read observed status and dates, with highlighted differences where a previous observation is available. Use pagination and observations-per-page controls for older entries.',
        },
      ],
      tips: [
        'History contains tracking snapshots, not every lookup attempt. Unchanged carrier observations can reuse the current snapshot.',
        'Status, monitoring state and lookup outcome describe different things. Use Audit for the latest lookup outcome.',
      ],
    },
  ],
  quotes: [
    {
      id: 'compare',
      title: 'Prepare a quote comparison',
      screenshot: 'quotes',
      intro: 'When Quote Compare is enabled, open it from Shipments and start a new comparison.',
      steps: [
        {
          title: 'Choose shipping services',
          text: 'Select the available providers you want to compare. Available options depend on provider configuration and the shipment.',
        },
        {
          title: 'Enter addresses and packages',
          text: 'Complete sender and recipient information, then package quantities, weights and dimensions. Review address suggestions or use manual entry where offered.',
        },
        {
          title: 'Compare and review results',
          text: 'Select Compare quotes after resolving highlighted fields. Review returned services, costs and provider errors. Use the comparison history to reopen a result or copy it into a new request.',
        },
      ],
      tips: [
        'A quote comparison does not book a shipment or create a shipping label.',
        'Unavailable or failed provider results are not prices. Correct inputs or use the available retry workflow.',
        'If Quote Compare is absent, it is not enabled for this dashboard.',
      ],
    },
  ],
  administration: [
    {
      id: 'accounts',
      title: 'Manage employee accounts',
      screenshot: 'accounts',
      intro:
        'Administration is available only to signed-in Admins. Use Accounts to provision access for employees.',
      steps: [
        {
          title: 'Review accounts',
          text: 'Open an employee record to review its profile, role and active state. Staff use normal shipment workflows; Admins also manage administration settings.',
        },
        {
          title: 'Create an account',
          text: 'Provide the employee information, role and issued password. The employee must replace that password before accessing business features.',
        },
      ],
      tips: [
        'Reset a password from the employee account when needed. A reset requires another password replacement and ends existing sessions.',
        'Deactivate access instead of deleting employee history. The app protects administrator changes that would remove required access.',
      ],
    },
    {
      id: 'sales-reps',
      title: 'Manage Sales Reps and carrier settings',
      screenshot: 'sales-reps',
      intro:
        'Sales Rep records organize shipment assignments. They are separate from employee sign-in accounts.',
      steps: [
        {
          title: 'Review Sales Reps',
          text: 'Each Sales Rep has a name and required unique email. Edit the record to correct its details; existing shipment assignments remain attributable.',
        },
        {
          title: 'Add a Sales Rep',
          text: 'Enter first name, last name and email. Creating a Sales Rep does not create an employee login account. Deactivated reps cannot receive new assignments.',
        },
      ],
      tips: [
        'Carriers: review and edit the supported carrier settings. Disabling a carrier prevents new checks and additions without hiding existing shipments.',
        'Quote providers: when Quote Compare is enabled, Admins manage supported provider settings and connections. Review validation and connection results before saving changes.',
        'Sales Rep email is contact information, not an automatic synchronization with employee accounts.',
      ],
    },
  ],
};
