'use strict';

/* ---------------------------------------------------------------
   Demo data model and fictional sample content.
   No secrets or real credentials are stored anywhere in this file
   or in the saved state.
   --------------------------------------------------------------- */
const STATE_VERSION = 1;
const STORAGE_KEY = 'teamgate-demo-state';
const ROLES = ['Cashier', 'Manager', 'Accountant'];
const PAGE_STATUSES = ['active', 'paused', 'archived'];
const APP_STATUSES = ['pending', 'approved', 'declined'];
const DEFAULT_ACCENT = '#4f46e5';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const EXAMPLE_BASE = 'https://portal.example/join/';

function createSeedState(now = new Date()) {
  // Timestamps are relative to "now" so the sample data always looks recent.
  const ago = (days, hours = 0) => new Date(now.getTime() - (days * 24 + hours) * 3600 * 1000).toISOString();

  const settings = {
    businessName: 'TeamGate',
    contactEmail: 'people@teamgate.example',
    accentColor: DEFAULT_ACCENT,
    logo: null,
    defaultWelcome: 'Thanks for your interest in joining our team. Start a sample application to see how the process works.',
    defaultApprovedWelcome: 'Welcome aboard! Your account is approved, and your team lead will be in touch with next steps.',
    copyrightHolder: 'TeamGate Demo Co.',
    previewImage: null,
  };

  const pages = [
    {
      id: 'page-cashier',
      title: 'Cashier team',
      slug: 'cashier',
      aliases: ['cashiers'],
      welcome: 'Join the front-of-store crew that keeps every visit quick and friendly.',
      approvedWelcome: 'Welcome to the cashier team! Your shift lead will share your first schedule soon.',
      role: 'Cashier',
      roleDescription: 'Cashiers greet customers, handle checkout at the front counter, and help keep the store floor tidy. Full training is provided.',
      logo: null,
      previewTitle: 'Join the TeamGate cashier team',
      previewDescription: 'Work the front counter with a friendly, supportive crew.',
      previewImage: null,
      status: 'active',
      createdAt: ago(30),
      updatedAt: ago(21),
    },
    {
      id: 'page-management',
      title: 'Management team',
      slug: 'management',
      aliases: [],
      welcome: null,
      approvedWelcome: null,
      role: 'Manager',
      roleDescription: 'Managers coordinate daily schedules, support team members, and keep each location running smoothly.',
      logo: null,
      previewTitle: 'Lead a TeamGate store team',
      previewDescription: 'Help a great team do its best work every day.',
      previewImage: null,
      status: 'active',
      createdAt: ago(29, 22),
      updatedAt: ago(0, 6),
    },
    {
      id: 'page-accounting',
      title: 'Accounting team',
      slug: 'accounting',
      aliases: [],
      welcome: 'Help us keep the numbers clear and the books balanced.',
      approvedWelcome: 'Welcome to accounting! Your onboarding checklist is ready.',
      role: 'Accountant',
      roleDescription: 'Accountants reconcile daily sales, prepare monthly reports, and keep supplier payments on track.',
      logo: null,
      previewTitle: 'Join the TeamGate accounting team',
      previewDescription: 'Keep the numbers clear for every store.',
      previewImage: null,
      status: 'paused',
      createdAt: ago(29, 20),
      updatedAt: ago(5),
    },
  ];

  const employees = [
    { id: 'emp-1', employeeId: 'TG-1041', name: 'Maya Chen', email: 'maya.chen@teamgate.example', role: 'Cashier', accountStatus: 'active' },
    { id: 'emp-2', employeeId: 'TG-1042', name: 'Omar Haddad', email: 'omar.haddad@teamgate.example', role: 'Manager', accountStatus: 'active' },
    { id: 'emp-3', employeeId: 'TG-1017', name: 'Lena Fischer', email: 'lena.fischer@teamgate.example', role: 'Cashier', accountStatus: 'active' },
    { id: 'emp-4', employeeId: 'TG-1023', name: 'Jamal Brooks', email: 'jamal.brooks@teamgate.example', role: 'Manager', accountStatus: 'active' },
    { id: 'emp-5', employeeId: 'TG-1036', name: 'Priya Nair', email: 'priya.nair@teamgate.example', role: 'Cashier', accountStatus: 'active' },
    { id: 'emp-6', employeeId: 'TG-1009', name: 'Tomás Álvarez', email: 'tomas.alvarez@teamgate.example', role: 'Accountant', accountStatus: 'disabled' },
  ];

  const application = (id, employeeRef, pageId, requestedRole, status, submittedDays, decidedDays, notes) => ({
    id,
    employeeRef,
    pageId,
    requestedRole,
    status,
    verifiedAt: ago(submittedDays, 0.2),
    submittedAt: ago(submittedDays),
    decidedAt: decidedDays === null ? null : ago(decidedDays),
    notes,
  });

  const applications = [
    application('app-1001', 'emp-1', 'page-cashier', 'Cashier', 'pending', 2, null, ''),
    application('app-1002', 'emp-2', 'page-management', 'Manager', 'pending', 1, null, 'Check availability for weekend shifts.'),
    application('app-1003', 'emp-3', 'page-cashier', 'Cashier', 'approved', 14, 12, 'Strong references from a previous retail job.'),
    application('app-1004', 'emp-4', 'page-management', 'Manager', 'approved', 10, 9, 'Interviewed by the regional manager.'),
    application('app-1005', 'emp-5', 'page-cashier', 'Cashier', 'declined', 7, 6, 'Availability did not match the open shifts.'),
    application('app-1006', 'emp-6', 'page-accounting', 'Accountant', 'approved', 19, 18, 'Account disabled after the sample contract ended.'),
  ];

  let n = 0;
  const entry = (at, action, targetId, description, actor = 'Demo admin') => ({ id: `act-${++n}`, at, actor, action, targetId, description });

  const activity = [
    entry(ago(30), 'page.create', 'page-cashier', 'Created the Cashier team signup page.'),
    entry(ago(29, 22), 'page.create', 'page-management', 'Created the Management team signup page.'),
    entry(ago(29, 20), 'page.create', 'page-accounting', 'Created the Accounting team signup page.'),
    entry(ago(21), 'page.rename', 'page-cashier', 'Changed the Cashier team address from “cashiers” to “cashier”. The old address still works.'),
    entry(ago(18), 'application.approve', 'app-1006', 'Approved Tomás Álvarez’s application (TG-1009) for Accounting team.'),
    entry(ago(17), 'employee.role', 'emp-6', 'Changed Tomás Álvarez’s role from Cashier to Accountant.'),
    entry(ago(12), 'application.approve', 'app-1003', 'Approved Lena Fischer’s application (TG-1017) for Cashier team.'),
    entry(ago(9), 'application.approve', 'app-1004', 'Approved Jamal Brooks’s application (TG-1023) for Management team.'),
    entry(ago(6), 'application.decline', 'app-1005', 'Declined Priya Nair’s application (TG-1036) for Cashier team.'),
    entry(ago(5), 'page.status', 'page-accounting', 'Paused the Accounting team signup page.'),
    entry(ago(4), 'employee.disable', 'emp-6', 'Disabled Tomás Álvarez’s account (TG-1009).'),
    entry(ago(2), 'application.submit', 'app-1001', 'Maya Chen submitted a demo application through Cashier team.', 'Sample applicant'),
    entry(ago(1), 'application.submit', 'app-1002', 'Omar Haddad submitted a demo application through Management team.', 'Sample applicant'),
    entry(ago(0, 6), 'page.update', 'page-management', 'Edited the Management team signup page.'),
  ];

  return { version: STATE_VERSION, settings, pages, employees, applications, activity };
}

function addActivity(state, action, targetId, description, actor = 'Demo admin') {
  state.activity.push({ id: uid('act'), at: nowIso(), actor, action, targetId, description });
}

/* ---------------------------------------------------------------
   Validation of saved data. Returns a cleaned state, or null if the
   saved data can't be trusted (the app then offers a reset).
   --------------------------------------------------------------- */
function validateState(s) {
  const str = (v) => typeof v === 'string';
  if (!s || typeof s !== 'object' || s.version !== STATE_VERSION) return null;
  const { settings, pages, employees, applications, activity } = s;
  if (!settings || typeof settings !== 'object') return null;
  if (![pages, employees, applications, activity].every(Array.isArray)) return null;
  if (!['businessName', 'contactEmail', 'defaultWelcome', 'defaultApprovedWelcome', 'copyrightHolder'].every((k) => str(settings[k]))) return null;

  for (const p of pages) {
    if (!p || !str(p.id) || !str(p.slug) || !str(p.title) || !Array.isArray(p.aliases)) return null;
    if (!PAGE_STATUSES.includes(p.status) || !ROLES.includes(p.role)) return null;
  }
  for (const e of employees) {
    if (!e || !str(e.id) || !str(e.employeeId) || !str(e.email) || !ROLES.includes(e.role)) return null;
    if (!['active', 'disabled'].includes(e.accountStatus)) return null;
  }
  for (const a of applications) {
    if (!a || !str(a.id) || !str(a.employeeRef) || !str(a.pageId)) return null;
    if (!APP_STATUSES.includes(a.status) || !ROLES.includes(a.requestedRole)) return null;
  }
  for (const x of activity) {
    if (!x || !str(x.id) || !str(x.description)) return null;
  }

  // Clean up anything that is optional or could be unsafe.
  settings.accentColor = isHexColor(settings.accentColor) ? settings.accentColor : DEFAULT_ACCENT;
  settings.logo = isSafeImage(settings.logo) ? settings.logo : null;
  settings.previewImage = isSafeImage(settings.previewImage) ? settings.previewImage : null;
  for (const p of pages) {
    p.aliases = p.aliases.filter(str);
    p.logo = isSafeImage(p.logo) ? p.logo : null;
    p.previewImage = isSafeImage(p.previewImage) ? p.previewImage : null;
    for (const k of ['welcome', 'approvedWelcome']) if (!str(p[k])) p[k] = null;
    for (const k of ['roleDescription', 'previewTitle', 'previewDescription']) if (!str(p[k])) p[k] = '';
  }
  for (const e of employees) if (!str(e.name)) e.name = e.email.split('@')[0];
  for (const x of activity) {
    if (!str(x.actor)) x.actor = 'Demo admin';
    if (!str(x.action)) x.action = 'other';
  }
  const pageIds = new Set(pages.map((p) => p.id));
  const empIds = new Set(employees.map((e) => e.id));
  s.applications = applications.filter((a) => pageIds.has(a.pageId) && empIds.has(a.employeeRef));
  for (const a of s.applications) if (!str(a.notes)) a.notes = '';
  return s;
}

/* Address-ending rules for signup pages. Returns an error message or null. */
function slugProblem(slug, state, ownPageId) {
  if (!slug) return 'Enter an address ending.';
  if (slug.length < 3 || slug.length > 50) return 'The address ending must be 3–50 characters long.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Use only lowercase letters, numbers, and single hyphens between words (for example, “front-desk”).';
  }
  for (const p of state.pages) {
    if (p.id === ownPageId) continue;
    if (p.slug === slug) return `“${slug}” is already used by the ${p.title} page.`;
    if (p.aliases.includes(slug)) return `“${slug}” is kept as a previous address for the ${p.title} page, so it can't be reused.`;
  }
  return null;
}
