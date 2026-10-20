'use strict';

/* =================================================================
   TeamGate employee portal — demo application.
   Everything runs in this browser. Nothing is sent anywhere: there is
   no login, no email delivery, no database, and no server.
   ================================================================= */

/* ---------- Selectors ---------- */
const st = () => store.state;
const settings = () => store.state.settings;
const pageById = (id) => st().pages.find((p) => p.id === id) || null;
const empById = (id) => st().employees.find((e) => e.id === id) || null;
const appById = (id) => st().applications.find((a) => a.id === id) || null;
const newestFirst = (key) => (a, b) => String(b[key] || '').localeCompare(String(a[key] || ''));

function resolveSlug(slug) {
  const s = String(slug || '').toLowerCase();
  let page = st().pages.find((p) => p.slug === s);
  if (page) return { page, viaAlias: false };
  page = st().pages.find((p) => p.aliases.includes(s));
  return page ? { page, viaAlias: true } : null;
}

const appsForEmployee = (empId) => st().applications.filter((a) => a.employeeRef === empId).sort(newestFirst('submittedAt'));

/* What the employee experiences for one application. */
function viewStatus(app) {
  const emp = empById(app.employeeRef);
  return app.status === 'approved' && emp && emp.accountStatus === 'disabled' ? 'disabled' : app.status;
}

function employeeStatus(emp) {
  const apps = appsForEmployee(emp.id);
  if (apps.some((a) => a.status === 'approved')) return emp.accountStatus === 'disabled' ? 'disabled' : 'approved';
  if (apps.some((a) => a.status === 'pending')) return 'pending';
  if (apps.some((a) => a.status === 'declined')) return 'declined';
  return 'none';
}

const pageWelcome = (p) => p.welcome ?? settings().defaultWelcome;
const pageApprovedWelcome = (p) => p.approvedWelcome ?? settings().defaultApprovedWelcome;
const pageLogo = (p) => p.logo ?? settings().logo;
const pagePreviewImage = (p) => p.previewImage ?? settings().previewImage;
const demoRoute = (slug) => `#/join/${slug}`;
const demoUrl = (slug) => location.href.split('#')[0] + demoRoute(slug);
const exampleUrl = (slug) => EXAMPLE_BASE + slug;

/* ---------- UI state (not saved) ---------- */
let menuOpen = false;
let firstRender = true;
let flow = null; // public sample-application flow: { pageId, empId, step, verifiedAt }
let editor = null; // page / branding editor draft images

const FILTER_DEFAULTS = {
  apps: { q: '', status: 'all', page: 'all', role: 'all' },
  emps: { q: '', role: 'all' },
  activity: { q: '', type: 'all' },
};
const filters = {
  apps: { ...FILTER_DEFAULTS.apps, status: 'pending' },
  emps: { ...FILTER_DEFAULTS.emps },
  activity: { ...FILTER_DEFAULTS.activity },
};

/* ---------- Small view helpers ---------- */
const STATUS_META = {
  pending: { label: 'Pending', icon: '◷' },
  approved: { label: 'Approved', icon: '✓' },
  declined: { label: 'Declined', icon: '✕' },
  disabled: { label: 'Disabled', icon: '⊘' },
  active: { label: 'Active', icon: '●' },
  paused: { label: 'Paused', icon: 'Ⅱ' },
  archived: { label: 'Archived', icon: '▣' },
  none: { label: 'No application', icon: '–' },
};

function badge(status) {
  const meta = STATUS_META[status] || { label: status, icon: '' };
  return html`<span class="badge badge-${status}"><span class="badge-icon" aria-hidden="true">${meta.icon}</span>${meta.label}</span>`;
}

function logoMark(src, name, size = 'md') {
  return src
    ? html`<img class="logo logo-${size}" src="${src}" alt="">`
    : html`<span class="logo logo-${size} logo-initials" aria-hidden="true">${initials(name)}</span>`;
}

function pageHeader(title, intro, actions) {
  return html`<header class="page-header">
    <div>
      <h1>${title}</h1>
      ${intro ? html`<p class="lead">${intro}</p>` : ''}
    </div>
    ${actions ? html`<div class="page-header-actions">${actions}</div>` : ''}
  </header>`;
}

function emptyState(title, text, action) {
  return html`<div class="empty-state">
    <p class="empty-title">${title}</p>
    <p>${text}</p>
    ${action || ''}
  </div>`;
}

function linkCard({ image, title, description, address, name }) {
  return html`<div class="link-card">
    ${image
      ? html`<img class="link-card-image" src="${image}" alt="">`
      : html`<div class="link-card-image link-card-placeholder" aria-hidden="true">${initials(name)}</div>`}
    <div class="link-card-body">
      <p class="link-card-domain">${address}</p>
      <p class="link-card-title">${title || 'Untitled link preview'}</p>
      <p class="link-card-desc">${description || 'No description yet.'}</p>
    </div>
  </div>`;
}

function detailList(rows) {
  return html`<dl class="details">${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
}

/* ---------- Layout ---------- */
const NAV = [
  ['overview', 'Overview', '#/admin'],
  ['applications', 'Applications', '#/admin/applications'],
  ['employees', 'Employees', '#/admin/employees'],
  ['pages', 'Signup pages', '#/admin/pages'],
  ['branding', 'Branding', '#/admin/branding'],
  ['activity', 'Activity', '#/admin/activity'],
  ['preview', 'Employee preview', '#/status'],
];

function demoBanner() {
  return html`<div class="demo-banner" role="note">
    <strong>Demo — sample data only</strong>
    <span class="demo-banner-detail">Fictional employees. Nothing is sent, saved to a server, or published.</span>
  </div>`;
}

function storageNotice() {
  if (store.mode === 'memory') {
    return html`<div class="storage-notice" role="note">
      <strong>Changes are temporary.</strong> Browser storage isn't available, so this demo is running in memory.
      Your changes will disappear when you close or refresh this page.
    </div>`;
  }
  if (store.mode === 'unreadable') {
    return html`<div class="storage-notice" role="note">
      <p><strong>Saved demo data couldn't be read.</strong> The original sample data is shown instead, and changes won't be saved until you reset.</p>
      <button type="button" class="btn btn-secondary btn-sm" data-action="reset-unreadable" id="reset-unreadable">Reset saved demo data</button>
    </div>`;
  }
  return '';
}

function sidebar(active) {
  const s = settings();
  const pending = st().applications.filter((a) => a.status === 'pending').length;
  return html`<aside class="sidebar">
    <div class="sidebar-top">
      <a class="brand" href="#/admin">
        ${logoMark(s.logo, s.businessName)}
        <span class="brand-text"><span class="brand-name">${s.businessName}</span><span class="brand-sub">Admin demo</span></span>
      </a>
      <button type="button" class="btn btn-secondary btn-sm menu-toggle" id="menu-toggle" data-action="toggle-menu"
        aria-expanded="${menuOpen ? 'true' : 'false'}" aria-controls="primary-nav">Menu</button>
    </div>
    <nav id="primary-nav" class="nav${menuOpen ? ' open' : ''}" aria-label="Admin demo">
      <ul>
        ${NAV.map(([key, label, href]) => html`<li><a class="nav-link" href="${href}"${key === active ? raw(' aria-current="page"') : ''}>
          <span>${label}</span>
          ${key === 'applications' && pending ? html`<span class="nav-count">${pending}<span class="visually-hidden"> pending</span></span>` : ''}
        </a></li>`)}
      </ul>
      <div class="nav-footer">
        <a class="nav-link nav-link-quiet" href="#/">Public page previews</a>
        <button type="button" class="btn btn-secondary btn-block" data-action="reset-demo" id="reset-demo">Reset demo</button>
      </div>
    </nav>
  </aside>`;
}

function publicHeader(view) {
  const s = settings();
  const logo = view.brandPage ? pageLogo(view.brandPage) : s.logo;
  return html`<header class="public-header">
    <div class="public-header-inner">
      <a class="brand" href="#/">${logoMark(logo, s.businessName)}<span class="brand-name">${s.businessName}</span></a>
      <a class="btn btn-secondary btn-sm" href="#/admin">Open admin demo</a>
    </div>
  </header>`;
}

function siteFooter() {
  const s = settings();
  return html`<footer class="site-footer">
    <div class="footer-inner">
      <p>© ${new Date().getFullYear()} ${s.copyrightHolder}</p>
      <nav aria-label="Footer">
        <ul class="footer-links">
          <li><a href="#/privacy">Privacy</a></li>
          <li><a href="#/terms">Terms</a></li>
          <li><a href="#/contact">Contact</a></li>
        </ul>
      </nav>
      <p class="footer-demo"><strong>Demo notice:</strong> a prototype with fictional sample data. Not affiliated with any other company.</p>
    </div>
  </footer>`;
}

function layout(view) {
  const top = html`${demoBanner()}${storageNotice()}`;
  if (view.layout === 'admin') {
    return html`${top}<div class="shell">${sidebar(view.nav)}<main id="main" class="main" tabindex="-1">${view.body}</main></div>${siteFooter()}`;
  }
  return html`${top}${publicHeader(view)}<main id="main" class="public-main" tabindex="-1">${view.body}</main>${siteFooter()}`;
}

/* =================================================================
   Public screens
   ================================================================= */
function homeView() {
  const s = settings();
  const pages = st().pages.filter((p) => p.status !== 'archived');
  return {
    title: 'Welcome',
    layout: 'public',
    body: html`
      <section class="hero">
        <p class="eyebrow">Employee portal prototype</p>
        <h1>${s.businessName} employee portal</h1>
        <p class="lead">This demo shows how a business could review employee account applications and manage branded signup pages. It uses fictional employees, and every action is simulated.</p>
        <div class="btn-row">
          <a class="btn btn-primary btn-lg" href="#/admin">Open admin demo</a>
          <a class="btn btn-secondary btn-lg" href="#/status">Employee preview</a>
        </div>
      </section>
      <section class="section" aria-labelledby="previews-heading">
        <h2 id="previews-heading">Signup page previews</h2>
        <p class="muted">Addresses on <code>portal.example</code> are examples only. They are not registered or published.</p>
        ${pages.length
          ? html`<ul class="card-grid">${pages.map((p) => html`<li class="card page-tile">
              <div class="row-between"><h3>${p.title}</h3>${badge(p.status)}</div>
              <p class="muted">${p.roleDescription || `Intended role: ${p.role}`}</p>
              <p class="small"><span class="muted">Example address:</span> <code>${exampleUrl(p.slug)}</code></p>
              <a class="btn btn-secondary" href="${demoRoute(p.slug)}">Preview<span class="visually-hidden"> the ${p.title} signup page</span></a>
            </li>`)}</ul>`
          : emptyState('No signup pages to show', 'Every signup page is archived. Restore one from the admin demo.', html`<a class="btn btn-secondary" href="#/admin/pages">Manage signup pages</a>`)}
      </section>`,
  };
}

function joinView(slug) {
  const found = resolveSlug(slug);
  if (!found) {
    return notFoundView(`No signup page uses the address ending “${slug}”. It may have been typed incorrectly.`);
  }
  const { page, viaAlias } = found;
  if (flow && flow.pageId !== page.id) flow = null;
  const s = settings();
  const available = page.status === 'active';
  return {
    title: page.title,
    layout: 'public',
    brandPage: page,
    body: html`
      <article class="signup">
        <div class="card signup-card">
          <div class="signup-brand">${logoMark(pageLogo(page), s.businessName, 'lg')}<span class="signup-business">${s.businessName}</span></div>
          <h1>${page.title}</h1>
          <p class="lead">${pageWelcome(page)}</p>
          ${viaAlias ? html`<p class="notice notice-info"><strong>Moved:</strong> you opened an earlier address (<code>/join/${slug}</code>). This page now lives at <code>/join/${page.slug}</code>, and the old address still works.</p>` : ''}
          <section class="role-box" aria-labelledby="role-heading">
            <h2 id="role-heading">About the role: ${page.role}</h2>
            <p>${page.roleDescription || 'No role description has been added yet.'}</p>
          </section>
          <div class="notice notice-demo" role="note">
            <strong>Demo notice.</strong> This page uses predefined fictional employees. It never asks for a real email address, password, or verification code, and nothing is sent anywhere.
          </div>
          ${available
            ? html`<div id="flow-area">${flowPanel(page)}</div>`
            : html`<div class="notice notice-warn" role="note"><strong>This signup page is unavailable.</strong> It is currently ${page.status} and isn't accepting new demo applications.</div>
                   <button type="button" class="btn btn-primary btn-lg" disabled>Try sample application</button>`}
        </div>
        <p class="example-address small muted">Example address: <code>${exampleUrl(page.slug)}</code> — illustrative only, not registered or published.</p>
      </article>`,
  };
}

function flowPanel(page) {
  if (!flow) {
    return html`<button type="button" class="btn btn-primary btn-lg" id="try-sample" data-action="choose-sample" data-page="${page.id}">Try sample application</button>`;
  }
  const emp = empById(flow.empId);
  if (!emp) {
    flow = null;
    return flowPanel(page);
  }
  if (flow.step === 'verify') {
    return html`<section class="flow" aria-labelledby="flow-title">
      <p class="step-label">Step 1 of 2</p>
      <h2 id="flow-title">Email verification (simulated)</h2>
      <p>You chose the sample employee <strong>${emp.name}</strong> (${emp.email}).</p>
      <p>In a real system, a verification link would be sent to this address. <strong>In this demo, no email is sent.</strong> Use the button below to simulate a verified address.</p>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="simulate-verify" data-action="simulate-verify">Simulate verified email</button>
        <button type="button" class="btn btn-ghost" id="change-sample" data-action="choose-sample" data-page="${page.id}">Choose a different sample</button>
      </div>
    </section>`;
  }
  return html`<section class="flow" aria-labelledby="flow-title">
    <p class="step-label">Step 2 of 2</p>
    <h2 id="flow-title">Review your demo application</h2>
    ${detailList([
      ['Name', emp.name],
      ['Employee ID', emp.employeeId],
      ['Business email (fictional)', emp.email],
      ['Requested role', page.role],
      ['Signup page', page.title],
      ['Email verification', html`Simulated at ${fmtDateTime(flow.verifiedAt)} — no email was sent`],
    ])}
    <div class="btn-row">
      <button type="button" class="btn btn-primary" id="submit-demo" data-action="submit-demo">Submit demo application</button>
      <button type="button" class="btn btn-ghost" id="cancel-flow" data-action="cancel-flow">Cancel</button>
    </div>
  </section>`;
}

function infoPage(title, body) {
  return {
    title,
    layout: 'public',
    body: html`<article class="card prose"><h1>${title}</h1>${body}
      <p><a href="#/">Back to the public page previews</a> · <a href="#/admin">Open admin demo</a></p></article>`,
  };
}

function privacyView() {
  return infoPage('Privacy', html`
    <p>This is a demonstration prototype. It stores sample settings and fictional records only in this browser's local storage, on this device.</p>
    <ul>
      <li>It does not submit applications to a server.</li>
      <li>It does not send email or verification codes.</li>
      <li>It does not ask for passwords or real personal information.</li>
      <li>It does not use analytics or tracking.</li>
    </ul>
    <p>You can remove everything at any time with <strong>Reset demo</strong> in the admin demo, or by clearing this site's data in your browser.</p>`);
}

function termsView() {
  return infoPage('Terms', html`
    <p>This site is a demonstration of an employee portal design. All people, email addresses, and employee IDs are fictional.</p>
    <p>Using this demo does not offer, promise, or imply employment, and it does not grant access to any business system. Sample approvals, roles, and decisions have no effect outside this page.</p>
    <p>${settings().businessName} is shown here as a sample business name. This demo is not affiliated with any other company.</p>`);
}

function contactView() {
  const s = settings();
  return infoPage('Contact', html`
    <p>The configured business contact for this demo is:</p>
    <p class="contact-address">${s.contactEmail}</p>
    <p class="muted">Messages are not sent from this demo.${s.contactEmail.endsWith('.example') ? ' Addresses ending in .example are reserved for examples and don’t receive mail.' : ''}</p>`);
}

function notFoundView(message) {
  return {
    title: 'Page not found',
    layout: 'public',
    body: html`<section class="card prose not-found">
      <h1>Page not found</h1>
      <p>${message || 'This address doesn’t match any screen in the demo.'}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="#/">See signup page previews</a>
        <a class="btn btn-secondary" href="#/admin">Open admin demo</a>
      </div>
    </section>`,
  };
}

/* =================================================================
   Employee preview
   ================================================================= */
function statusView(empId) {
  const emps = st().employees;
  const emp = empId ? empById(empId) : emps[0];
  if (empId && !emp) return adminNotFound('There is no sample account with that identifier.');
  const s = settings();
  const apps = emp ? appsForEmployee(emp.id) : [];
  return {
    title: 'Employee preview',
    layout: 'admin',
    nav: 'preview',
    body: html`
      ${pageHeader('Employee preview', 'See what a sample employee would see. In this demo no sign-in is needed — pick a sample account below.')}
      <div class="card field-inline">
        <label for="sample-account">Sample account</label>
        <select id="sample-account" data-change="pick-account">
          ${options(emps.map((e) => [e.id, `${e.name} — ${e.employeeId} (${e.email})`]), emp && emp.id)}
        </select>
      </div>
      <section class="employee-view" aria-labelledby="employee-view-title" style="${themeStyle(s.accentColor)}">
        <div class="employee-view-head">
          ${logoMark(s.logo, s.businessName)}
          <div><p class="employee-view-business">${s.businessName}</p><h2 id="employee-view-title">Your account status</h2></div>
        </div>
        ${!emp
          ? emptyState('No sample accounts', 'Reset the demo to restore the sample employees.')
          : apps.length
            ? apps.map((a) => statusCard(a, emp))
            : emptyState('No applications yet', `${emp.name} hasn't submitted a demo application. Try one from a public signup page.`, html`<a class="btn btn-secondary" href="#/">See signup pages</a>`)}
      </section>
      <div class="btn-row">
        <a class="btn btn-secondary" href="#/">Public page previews</a>
        <a class="btn btn-ghost" href="#/admin">Back to admin demo</a>
      </div>`,
  };
}

/* Employee-facing card. Private admin notes are intentionally never read here. */
function statusCard(app, emp) {
  const page = pageById(app.pageId);
  const status = viewStatus(app);
  const contact = settings().contactEmail;
  const messages = {
    pending: html`<p class="status-message">Your application is waiting for review.</p>`,
    approved: html`<p class="status-message">${pageApprovedWelcome(page)}</p><p>Your assigned role: <strong>${emp.role}</strong></p>`,
    declined: html`<p class="status-message">Your application was declined.</p><p>If you have questions, please contact ${contact}.</p>`,
    disabled: html`<p class="status-message">Your access has been disabled.</p><p>Please contact ${contact} for help.</p>`,
  };
  return html`<article class="status-card status-${status}">
    <div class="row-between"><h3>${page.title}</h3>${badge(status)}</div>
    ${messages[status]}
    ${detailList([
      ['Employee ID', emp.employeeId],
      ['Business email', emp.email],
      ['Requested role', app.requestedRole],
      ['Signup page', page.title],
      ['Submitted', fmtDate(app.submittedAt)],
      ['Current status', STATUS_META[status].label],
    ])}
    <a href="${demoRoute(page.slug)}">View the public signup page<span class="visually-hidden"> for ${page.title}</span></a>
  </article>`;
}

/* =================================================================
   Admin: overview
   ================================================================= */
function overviewView() {
  const s = st();
  const pending = s.applications.filter((a) => a.status === 'pending').sort(newestFirst('submittedAt'));
  const stats = [
    ['Pending applications', pending.length, '#/admin/applications?status=pending', 'pending'],
    ['Approved employees', s.employees.filter((e) => employeeStatus(e) === 'approved').length, '#/admin/employees', 'approved'],
    ['Declined applications', s.applications.filter((a) => a.status === 'declined').length, '#/admin/applications?status=declined', 'declined'],
    ['Active signup pages', s.pages.filter((p) => p.status === 'active').length, '#/admin/pages', 'active'],
  ];
  const latest = [...s.activity].sort(newestFirst('at')).slice(0, 5);
  return {
    title: 'Overview',
    layout: 'admin',
    nav: 'overview',
    body: html`
      ${pageHeader('Overview', 'A summary of the current demo data. Counts update as you make decisions.')}
      <ul class="stats">
        ${stats.map(([label, n, href, kind]) => html`<li><a class="card stat stat-${kind}" href="${href}">
          <span class="stat-value">${n}</span><span class="stat-label">${label}</span>
        </a></li>`)}
      </ul>
      <div class="two-col">
        <section class="card" aria-labelledby="recent-pending">
          <div class="row-between"><h2 id="recent-pending">Recent pending applications</h2><a href="#/admin/applications?status=pending" class="small">View all</a></div>
          ${pending.length
            ? html`<ul class="item-list">${pending.slice(0, 5).map((a) => {
                const e = empById(a.employeeRef);
                const p = pageById(a.pageId);
                return html`<li><a class="item-link" href="#/admin/applications/${a.id}">
                  <span class="item-main">${e.email}</span>
                  <span class="item-meta">${e.employeeId} · ${p.title} · ${fmtDate(a.submittedAt)}</span>
                </a></li>`;
              })}</ul>`
            : emptyState('Nothing waiting', 'There are no pending applications right now.')}
        </section>
        <section class="card" aria-labelledby="latest-activity">
          <div class="row-between"><h2 id="latest-activity">Latest activity</h2><a href="#/admin/activity" class="small">View all</a></div>
          ${latest.length ? activityList(latest) : emptyState('No activity yet', 'Actions you take will appear here.')}
        </section>
      </div>`,
  };
}

/* =================================================================
   Admin: applications
   ================================================================= */
function filteredApps() {
  const f = filters.apps;
  const q = f.q.trim().toLowerCase();
  return st().applications
    .filter((a) => {
      const e = empById(a.employeeRef);
      if (f.status !== 'all' && a.status !== f.status) return false;
      if (f.page !== 'all' && a.pageId !== f.page) return false;
      if (f.role !== 'all' && a.requestedRole !== f.role) return false;
      if (q && !(e.email.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q))) return false;
      return true;
    })
    .sort(newestFirst('submittedAt'));
}

function appsResults() {
  const list = filteredApps();
  if (!list.length) {
    return emptyState('No applications match', 'Try a different search, or clear the search and filters.',
      html`<button type="button" class="btn btn-secondary" id="clear-apps" data-action="clear-filters" data-set="apps">Clear search and filters</button>`);
  }
  return html`<div class="table-wrap"><table class="data-table">
    <caption class="visually-hidden">Applications</caption>
    <thead><tr><th scope="col">Employee ID</th><th scope="col">Email</th><th scope="col">Requested role</th><th scope="col">Signup page</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
    <tbody>${list.map((a) => {
      const e = empById(a.employeeRef);
      const p = pageById(a.pageId);
      return html`<tr>
        <td data-label="Employee ID">${e.employeeId}</td>
        <td data-label="Email">${e.email}</td>
        <td data-label="Requested role">${a.requestedRole}</td>
        <td data-label="Signup page">${p.title}</td>
        <td data-label="Submitted">${fmtDate(a.submittedAt)}</td>
        <td data-label="Status">${badge(a.status)}${viewStatus(a) === 'disabled' ? html` <span class="small muted">(account disabled)</span>` : ''}</td>
        <td class="cell-action"><a class="btn btn-secondary btn-sm" href="#/admin/applications/${a.id}">View details<span class="visually-hidden"> for ${e.email}</span></a></td>
      </tr>`;
    })}</tbody>
  </table></div>`;
}

function appsCount() {
  return `Showing ${plural(filteredApps().length, 'application', 'applications')}.`;
}

function applicationsView(query) {
  if (query.status && ['pending', 'approved', 'declined', 'all'].includes(query.status)) filters.apps.status = query.status;
  const f = filters.apps;
  return {
    title: 'Applications',
    layout: 'admin',
    nav: 'applications',
    body: html`
      ${pageHeader('Applications', 'Review fictional employee applications. Decisions are simulated, and no email is sent.')}
      <form class="filters card" role="search" aria-label="Filter applications" data-form="noop">
        <div class="field"><label for="apps-q">Search</label>
          <input type="search" id="apps-q" data-filter="apps.q" value="${f.q}" placeholder="Email or employee ID" autocomplete="off"></div>
        <div class="field"><label for="apps-status">Status</label>
          <select id="apps-status" data-filter="apps.status">${options([['pending', 'Pending'], ['approved', 'Approved'], ['declined', 'Declined'], ['all', 'All statuses']], f.status)}</select></div>
        <div class="field"><label for="apps-page">Signup page</label>
          <select id="apps-page" data-filter="apps.page">${options([['all', 'All signup pages'], ...st().pages.map((p) => [p.id, p.title])], f.page)}</select></div>
        <div class="field"><label for="apps-role">Requested role</label>
          <select id="apps-role" data-filter="apps.role">${options([['all', 'All roles'], ...ROLES.map((r) => [r, r])], f.role)}</select></div>
      </form>
      <p class="results-count" id="apps-count">${appsCount()}</p>
      <div id="apps-results">${appsResults()}</div>`,
  };
}

function applicationDetailView(id) {
  const app = appById(id);
  if (!app) return adminNotFound('That application could not be found. It may have been removed by a demo reset.');
  const emp = empById(app.employeeRef);
  const page = pageById(app.pageId);
  const related = st().activity.filter((x) => x.targetId === app.id || x.targetId === emp.id).sort(newestFirst('at'));

  const decisionText = {
    pending: 'This application is waiting for a decision.',
    approved: emp.accountStatus === 'disabled'
      ? 'This application is approved, but the employee’s account is currently disabled. Re-enable it from the Employees screen.'
      : 'This application is approved. The employee appears in the Employees list.',
    declined: 'This application was declined. You can reverse the decision.',
  }[app.status];

  const decisionButtons = {
    pending: html`<button type="button" class="btn btn-primary" id="decide-approve" data-action="decide" data-app="${app.id}" data-decision="approved">Approve application</button>
      <button type="button" class="btn btn-danger" id="decide-decline" data-action="decide" data-app="${app.id}" data-decision="declined">Decline application</button>`,
    approved: html`<button type="button" class="btn btn-danger" id="decide-decline" data-action="decide" data-app="${app.id}" data-decision="declined">Change to declined…</button>
      <button type="button" class="btn btn-secondary" id="decide-pending" data-action="decide" data-app="${app.id}" data-decision="pending">Move back to pending</button>`,
    declined: html`<button type="button" class="btn btn-primary" id="decide-approve" data-action="decide" data-app="${app.id}" data-decision="approved">Change to approved</button>
      <button type="button" class="btn btn-secondary" id="decide-pending" data-action="decide" data-app="${app.id}" data-decision="pending">Move back to pending</button>`,
  }[app.status];

  return {
    title: `Application ${emp.employeeId}`,
    layout: 'admin',
    nav: 'applications',
    body: html`
      <p><a href="#/admin/applications" class="back-link">← All applications</a></p>
      ${pageHeader(`Application from ${emp.name}`, null, badge(app.status))}
      <div class="two-col two-col-wide">
        <div class="stack">
          <section class="card" aria-labelledby="decision-heading">
            <h2 id="decision-heading" tabindex="-1">Decision</h2>
            <p>${decisionText}</p>
            <div class="btn-row">${decisionButtons}</div>
            <p class="small muted">Decisions are simulated. No email is sent.</p>
          </section>
          <section class="card" aria-labelledby="details-heading">
            <h2 id="details-heading">Application details</h2>
            ${detailList([
              ['Application ID', app.id],
              ['Employee ID', emp.employeeId],
              ['Name', emp.name],
              ['Business email (fictional)', emp.email],
              ['Requested role', app.requestedRole],
              ['Assigned role', emp.role],
              ['Signup page', html`<a href="${demoRoute(page.slug)}">${page.title}</a>`],
              ['Email verification', html`Simulated · ${fmtDateTime(app.verifiedAt)}`],
              ['Submitted', fmtDateTime(app.submittedAt)],
              ['Decision made', app.decidedAt ? fmtDateTime(app.decidedAt) : 'Not yet'],
              ['Account status', emp.accountStatus === 'disabled' ? 'Disabled' : 'Active'],
            ])}
            <p><a href="#/status/${emp.id}">See this employee’s status page</a></p>
          </section>
        </div>
        <div class="stack">
          <section class="card" aria-labelledby="role-edit-heading">
            <h2 id="role-edit-heading">Assigned role</h2>
            <div class="field">
              <label for="assigned-role">Role for ${emp.name}</label>
              <select id="assigned-role">${options(ROLES.map((r) => [r, r]), emp.role)}</select>
              <p class="hint">Roles are descriptive labels in this prototype. They don’t unlock any external system.</p>
            </div>
            <button type="button" class="btn btn-secondary" id="save-role" data-action="save-role" data-emp="${emp.id}">Save role</button>
          </section>
          <section class="card card-private" aria-labelledby="note-heading">
            <h2 id="note-heading">Private admin note</h2>
            <div class="field">
              <label for="app-note">Note</label>
              <textarea id="app-note" rows="4" maxlength="1000" aria-describedby="note-hint">${app.notes}</textarea>
              <p class="hint" id="note-hint"><span aria-hidden="true">🔒</span> Only visible to admins. Never shown on employee screens.</p>
            </div>
            <button type="button" class="btn btn-secondary" id="save-note" data-action="save-note" data-app="${app.id}">Save note</button>
          </section>
          <section class="card" aria-labelledby="history-heading">
            <h2 id="history-heading">History</h2>
            ${related.length ? activityList(related) : emptyState('No history yet', 'Actions on this application will appear here.')}
          </section>
        </div>
      </div>`,
  };
}

/* =================================================================
   Admin: employees
   ================================================================= */
function filteredEmployees() {
  const f = filters.emps;
  const q = f.q.trim().toLowerCase();
  return st().employees.filter((e) => {
    const status = employeeStatus(e);
    if (status !== 'approved' && status !== 'disabled') return false;
    if (f.role !== 'all' && e.role !== f.role) return false;
    if (q && !(e.email.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q))) return false;
    return true;
  });
}

function empsResults() {
  const list = filteredEmployees();
  if (!list.length) {
    return emptyState('No employees match', 'Only approved and disabled employees appear here. Try a different search or role.',
      html`<button type="button" class="btn btn-secondary" id="clear-emps" data-action="clear-filters" data-set="emps">Clear search and filters</button>`);
  }
  return html`<div class="table-wrap"><table class="data-table">
    <caption class="visually-hidden">Employees</caption>
    <thead><tr><th scope="col">Employee ID</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
    <tbody>${list.map((e) => {
      const status = employeeStatus(e);
      const app = appsForEmployee(e.id).find((a) => a.status === 'approved');
      return html`<tr>
        <td data-label="Employee ID">${e.employeeId}</td>
        <td data-label="Name">${e.name}</td>
        <td data-label="Email">${e.email}</td>
        <td data-label="Role">${e.role}</td>
        <td data-label="Status">${badge(status)}</td>
        <td class="cell-action"><div class="btn-row btn-row-tight">
          <button type="button" class="btn btn-secondary btn-sm" id="role-${e.id}" data-action="change-role" data-emp="${e.id}">Change role<span class="visually-hidden"> for ${e.name}</span></button>
          ${status === 'disabled'
            ? html`<button type="button" class="btn btn-secondary btn-sm" id="toggle-${e.id}" data-action="set-account" data-emp="${e.id}" data-to="active">Re-enable<span class="visually-hidden"> ${e.name}</span></button>`
            : html`<button type="button" class="btn btn-secondary btn-sm" id="toggle-${e.id}" data-action="set-account" data-emp="${e.id}" data-to="disabled">Disable<span class="visually-hidden"> ${e.name}</span></button>`}
          ${app ? html`<a class="btn btn-ghost btn-sm" href="#/admin/applications/${app.id}">Application<span class="visually-hidden"> for ${e.name}</span></a>` : ''}
        </div></td>
      </tr>`;
    })}</tbody>
  </table></div>`;
}

function empsCount() {
  return `Showing ${plural(filteredEmployees().length, 'employee', 'employees')}.`;
}

function employeesView() {
  const f = filters.emps;
  return {
    title: 'Employees',
    layout: 'admin',
    nav: 'employees',
    body: html`
      ${pageHeader('Employees', 'Approved and disabled sample employees. Disabling keeps their application history.')}
      <form class="filters card" role="search" aria-label="Filter employees" data-form="noop">
        <div class="field"><label for="emps-q">Search</label>
          <input type="search" id="emps-q" data-filter="emps.q" value="${f.q}" placeholder="Email or employee ID" autocomplete="off"></div>
        <div class="field"><label for="emps-role">Role</label>
          <select id="emps-role" data-filter="emps.role">${options([['all', 'All roles'], ...ROLES.map((r) => [r, r])], f.role)}</select></div>
      </form>
      <p class="results-count" id="emps-count">${empsCount()}</p>
      <div id="emps-results">${empsResults()}</div>`,
  };
}

/* =================================================================
   Admin: signup pages
   ================================================================= */
const STATUS_ORDER = { active: 0, paused: 1, archived: 2 };

function pagesView() {
  const pages = [...st().pages].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title));
  return {
    title: 'Signup pages',
    layout: 'admin',
    nav: 'pages',
    body: html`
      ${pageHeader('Signup pages', 'Create and manage branded demo signup pages.', html`<a class="btn btn-primary" href="#/admin/pages/new">Create page</a>`)}
      <p class="notice notice-info"><strong>Example addresses only.</strong> Addresses on <code>portal.example</code> are illustrations — they aren’t registered or published. The working demo route (starting with <code>#/join/</code>) opens the page in this browser.</p>
      ${pages.length
        ? html`<ul class="page-list">${pages.map(pageAdminCard)}</ul>`
        : emptyState('No signup pages yet', 'Create your first demo signup page.', html`<a class="btn btn-primary" href="#/admin/pages/new">Create page</a>`)}`,
  };
}

function pageAdminCard(p) {
  const s = settings();
  const statusButtons = {
    active: html`<button type="button" class="btn btn-secondary btn-sm" data-action="page-status" data-page="${p.id}" data-to="paused">Pause<span class="visually-hidden"> ${p.title}</span></button>
      <button type="button" class="btn btn-secondary btn-sm" data-action="page-status" data-page="${p.id}" data-to="archived">Archive<span class="visually-hidden"> ${p.title}</span></button>`,
    paused: html`<button type="button" class="btn btn-secondary btn-sm" data-action="page-status" data-page="${p.id}" data-to="active">Reactivate<span class="visually-hidden"> ${p.title}</span></button>
      <button type="button" class="btn btn-secondary btn-sm" data-action="page-status" data-page="${p.id}" data-to="archived">Archive<span class="visually-hidden"> ${p.title}</span></button>`,
    archived: html`<button type="button" class="btn btn-secondary btn-sm" data-action="page-status" data-page="${p.id}" data-to="paused">Restore as paused<span class="visually-hidden"> ${p.title}</span></button>`,
  }[p.status];
  return html`<li class="card page-admin-card">
    <div class="row-between"><h2 id="page-title-${p.id}" tabindex="-1">${p.title}</h2>${badge(p.status)}</div>
    ${detailList([
      ['Intended role', p.role],
      ['Example address', html`<code>${exampleUrl(p.slug)}</code> <span class="tag">Example only</span>`],
      ['Working demo route', html`<code>${demoRoute(p.slug)}</code>`],
      ['Previous address endings', p.aliases.length ? p.aliases.map((a, i) => html`${i ? ', ' : ''}<code>${a}</code>`) : 'None'],
      ['Last updated', fmtDate(p.updatedAt)],
    ])}
    <details class="link-preview-details">
      <summary>Link preview</summary>
      ${linkCard({ image: pagePreviewImage(p), title: p.previewTitle, description: p.previewDescription, address: exampleUrl(p.slug), name: s.businessName })}
    </details>
    <div class="btn-row btn-row-tight">
      <a class="btn btn-secondary btn-sm" href="${demoRoute(p.slug)}">Preview<span class="visually-hidden"> ${p.title}</span></a>
      <a class="btn btn-secondary btn-sm" href="#/admin/pages/${p.id}/edit">Edit<span class="visually-hidden"> ${p.title}</span></a>
      <button type="button" class="btn btn-secondary btn-sm" id="copy-${p.id}" data-action="copy-link" data-page="${p.id}">Copy demo link<span class="visually-hidden"> for ${p.title}</span></button>
      ${statusButtons}
    </div>
  </li>`;
}

/* ---------- Shared editor widgets ---------- */
function overrideTextField({ id, name, label, value, defaultValue, hint }) {
  const useDefault = value === null;
  return html`<div class="field override" data-override="${name}">
    <div class="field-head"><label for="${id}">${label}</label><span class="override-tag${useDefault ? '' : ' is-custom'}" id="${id}-tag">${useDefault ? 'Using business default' : 'Custom for this page'}</span></div>
    <textarea id="${id}" name="${name}" rows="3" maxlength="400" aria-describedby="${id}-tag ${id}-error"${attrIf(useDefault, 'disabled')}>${useDefault ? defaultValue : value}</textarea>
    ${hint ? html`<p class="hint">${hint}</p>` : ''}
    <p class="field-error" id="${id}-error" hidden></p>
    <label class="check"><input type="checkbox" name="${name}__default" data-override-toggle="${name}"${attrIf(useDefault, 'checked')}> Use business default</label>
  </div>`;
}

function thumbHtml(src, label, note) {
  return src
    ? html`<img src="${src}" alt="Current ${label}">${note ? html`<span class="thumb-note">${note}</span>` : ''}`
    : html`<span class="thumb-empty">No image</span>`;
}

function imageField({ key, label, hint, allowDefault }) {
  const useDefault = allowDefault && editor.useDefault[key];
  const src = useDefault ? settings()[key] : editor.images[key];
  return html`<div class="field image-field" data-image-field="${key}"${allowDefault ? raw(` data-override="${key}"`) : ''}>
    <div class="field-head"><span class="label" id="${key}-label">${label}</span>
      ${allowDefault ? html`<span class="override-tag${useDefault ? '' : ' is-custom'}">${useDefault ? 'Using business default' : 'Custom for this page'}</span>` : ''}</div>
    <div class="image-row">
      <div class="thumb" id="${key}-thumb">${thumbHtml(src, label.toLowerCase(), useDefault ? 'Business default' : '')}</div>
      <div class="image-controls">
        <label for="${key}-file" class="small">Upload ${label.toLowerCase()} — PNG, JPEG, or WebP, up to 2 MB</label>
        <input type="file" id="${key}-file" accept="image/png,image/jpeg,image/webp" data-image-input="${key}" aria-describedby="${key}-error ${key}-hint">
        <button type="button" class="btn btn-secondary btn-sm" id="${key}-remove" data-action="remove-image" data-key="${key}"${attrIf(useDefault || !editor.images[key], 'disabled')}>Remove image</button>
        <p class="hint" id="${key}-hint">${hint || ''}</p>
        <p class="field-error" id="${key}-error" hidden></p>
      </div>
    </div>
    ${allowDefault ? html`<label class="check"><input type="checkbox" name="${key}__default" data-override-toggle="${key}"${attrIf(useDefault, 'checked')}> Use business default</label>` : ''}
  </div>`;
}

function errorSummary() {
  return html`<div id="form-errors" class="error-summary" tabindex="-1" hidden></div>`;
}

/* ---------- Page editor ---------- */
function pageEditorView(pageId) {
  const isNew = !pageId;
  const page = isNew ? null : pageById(pageId);
  if (!isNew && !page) return adminNotFound('That signup page could not be found.');
  const s = settings();
  const p = page || {
    title: '', slug: '', aliases: [], welcome: null, approvedWelcome: null, role: 'Cashier', roleDescription: '',
    logo: null, previewTitle: '', previewDescription: '', previewImage: null, status: 'active',
  };
  editor = {
    kind: 'page',
    pageId,
    slugTouched: !isNew,
    images: { logo: p.logo, previewImage: p.previewImage },
    useDefault: { logo: p.logo === null, previewImage: p.previewImage === null },
  };
  const title = isNew ? 'Create signup page' : `Edit ${p.title}`;
  return {
    title,
    layout: 'admin',
    nav: 'pages',
    body: html`
      <p><a href="#/admin/pages" class="back-link">← All signup pages</a></p>
      ${pageHeader(title, 'Fields marked “Using business default” follow your Branding settings until you customise them.')}
      <form id="page-form" class="editor-form" data-form="page" novalidate>
        ${errorSummary()}
        <fieldset class="card">
          <legend>Page details</legend>
          <div class="field">
            <label for="pf-title">Display title</label>
            <input type="text" id="pf-title" name="title" value="${p.title}" maxlength="80" required aria-describedby="pf-title-error">
            <p class="field-error" id="pf-title-error" hidden></p>
          </div>
          <div class="field">
            <label for="pf-slug">Address ending</label>
            <div class="input-prefix"><span aria-hidden="true">portal.example/join/</span>
              <input type="text" id="pf-slug" name="slug" value="${p.slug}" maxlength="50" autocomplete="off" spellcheck="false" required aria-describedby="pf-slug-hint pf-slug-error"></div>
            <p class="hint" id="pf-slug-hint">3–50 characters: lowercase letters, numbers, and single hyphens between words. If you change it later, the old ending keeps working.</p>
            <p class="field-error" id="pf-slug-error" hidden></p>
          </div>
          <div class="field-grid">
            <div class="field"><label for="pf-role">Intended role</label>
              <select id="pf-role" name="role">${options(ROLES.map((r) => [r, r]), p.role)}</select></div>
            <div class="field"><label for="pf-status">Status</label>
              <select id="pf-status" name="status">${options([['active', 'Active'], ['paused', 'Paused'], ['archived', 'Archived']], p.status)}</select></div>
          </div>
          <div class="field">
            <label for="pf-desc">Role description</label>
            <textarea id="pf-desc" name="roleDescription" rows="3" maxlength="500">${p.roleDescription}</textarea>
            <p class="hint">Describe the intended employee role for people viewing the page.</p>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Messages</legend>
          ${overrideTextField({ id: 'pf-welcome', name: 'welcome', label: 'Welcome message', value: p.welcome, defaultValue: s.defaultWelcome })}
          ${overrideTextField({ id: 'pf-approved', name: 'approvedWelcome', label: 'Approved-user welcome message', value: p.approvedWelcome, defaultValue: s.defaultApprovedWelcome, hint: 'Shown on the employee status page after approval.' })}
        </fieldset>

        <fieldset class="card">
          <legend>Logo</legend>
          ${imageField({ key: 'logo', label: 'Logo', allowDefault: true, hint: 'Shown at the top of this signup page.' })}
        </fieldset>

        <fieldset class="card">
          <legend>Link preview</legend>
          <p class="hint">How a shared link to this page could look in a chat or social post.</p>
          <div class="field"><label for="pf-ptitle">Link preview title</label>
            <input type="text" id="pf-ptitle" name="previewTitle" value="${p.previewTitle}" maxlength="100"></div>
          <div class="field"><label for="pf-pdesc">Link preview description</label>
            <textarea id="pf-pdesc" name="previewDescription" rows="2" maxlength="200">${p.previewDescription}</textarea></div>
          ${imageField({ key: 'previewImage', label: 'Link preview image', allowDefault: true })}
          <p class="label">Preview</p>
          <div id="link-preview">${pageEditorPreview(p)}</div>
        </fieldset>

        ${isNew ? '' : html`<section class="card" aria-labelledby="page-info-heading">
          <h2 id="page-info-heading">Page information</h2>
          ${detailList([
            ['Internal ID', html`<code>${page.id}</code>`],
            ['Created', fmtDateTime(page.createdAt)],
            ['Last updated', fmtDateTime(page.updatedAt)],
            ['Previous address endings', page.aliases.length ? page.aliases.map((a, i) => html`${i ? ', ' : ''}<code>${a}</code>`) : 'None'],
          ])}
        </section>`}

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isNew ? 'Create page' : 'Save changes'}</button>
          <a class="btn btn-ghost" href="#/admin/pages">Cancel</a>
        </div>
      </form>`,
  };
}

/* With `initial`, preview those values (first render); otherwise read the live form. */
function pageEditorPreview(initial) {
  const s = settings();
  const f = initial ? null : document.getElementById('page-form').elements;
  const v = initial || { slug: f.slug.value.trim(), previewTitle: f.previewTitle.value.trim(), previewDescription: f.previewDescription.value.trim() };
  return linkCard({
    image: editor.useDefault.previewImage ? s.previewImage : editor.images.previewImage,
    title: v.previewTitle,
    description: v.previewDescription,
    address: exampleUrl(v.slug || 'your-page'),
    name: s.businessName,
  });
}

/* ---------- Branding editor ---------- */
function brandingView() {
  const s = settings();
  editor = { kind: 'branding', images: { logo: s.logo, previewImage: s.previewImage }, useDefault: {} };
  return {
    title: 'Branding',
    layout: 'admin',
    nav: 'branding',
    body: html`
      ${pageHeader('Branding', 'Business-wide settings. Signup pages use these unless they have their own override.')}
      <div class="branding-layout">
        <form id="branding-form" class="editor-form" data-form="branding" novalidate>
          ${errorSummary()}
          <fieldset class="card">
            <legend>Business</legend>
            <div class="field"><label for="bf-name">Business name</label>
              <input type="text" id="bf-name" name="businessName" value="${s.businessName}" maxlength="60" required aria-describedby="bf-name-error">
              <p class="field-error" id="bf-name-error" hidden></p></div>
            ${imageField({ key: 'logo', label: 'Logo', hint: 'Without a logo, the business initials are shown.' })}
            <div class="field">
              <label for="bf-accent">Accent colour</label>
              <div class="color-row">
                <input type="color" id="bf-accent-picker" value="${s.accentColor}" data-sync="accent-picker" aria-label="Accent colour picker">
                <input type="text" id="bf-accent" name="accentColor" value="${s.accentColor}" maxlength="7" spellcheck="false" data-sync="accent-text" aria-describedby="bf-accent-hint bf-accent-error">
              </div>
              <p class="hint" id="bf-accent-hint">A hex colour such as #4f46e5. Button text switches between light and dark automatically to stay readable.</p>
              <p class="field-error" id="bf-accent-error" hidden></p>
            </div>
          </fieldset>
          <fieldset class="card">
            <legend>Default messages</legend>
            <div class="field"><label for="bf-welcome">Default welcome message</label>
              <textarea id="bf-welcome" name="defaultWelcome" rows="3" maxlength="400" aria-describedby="bf-welcome-error">${s.defaultWelcome}</textarea>
              <p class="field-error" id="bf-welcome-error" hidden></p></div>
            <div class="field"><label for="bf-approved">Default approved-user welcome message</label>
              <textarea id="bf-approved" name="defaultApprovedWelcome" rows="3" maxlength="400" aria-describedby="bf-approved-error">${s.defaultApprovedWelcome}</textarea>
              <p class="field-error" id="bf-approved-error" hidden></p></div>
          </fieldset>
          <fieldset class="card">
            <legend>Contact and footer</legend>
            <div class="field"><label for="bf-contact">Contact email</label>
              <input type="email" id="bf-contact" name="contactEmail" value="${s.contactEmail}" maxlength="120" aria-describedby="bf-contact-hint bf-contact-error">
              <p class="hint" id="bf-contact-hint">Shown on the Contact page and to declined or disabled employees. Use an address ending in <code>.example</code> for testing.</p>
              <p class="field-error" id="bf-contact-error" hidden></p></div>
            <div class="field"><label for="bf-copy">Footer copyright holder</label>
              <input type="text" id="bf-copy" name="copyrightHolder" value="${s.copyrightHolder}" maxlength="80" aria-describedby="bf-copy-error">
              <p class="field-error" id="bf-copy-error" hidden></p></div>
          </fieldset>
          <fieldset class="card">
            <legend>Link preview</legend>
            ${imageField({ key: 'previewImage', label: 'Default preview image', hint: 'Used for signup-page link previews unless a page has its own image.' })}
          </fieldset>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save branding</button>
            <button type="button" class="btn btn-ghost" id="discard-branding" data-action="discard-branding">Discard changes</button>
            <span class="unsaved-flag" id="unsaved-flag" hidden>Unsaved changes</span>
          </div>
        </form>
        <aside class="card preview-panel" aria-labelledby="live-preview-heading">
          <h2 id="live-preview-heading">Live preview</h2>
          <p class="hint">Changes appear here as you type. They aren’t saved until you select Save branding.</p>
          <div id="brand-preview">${brandingPreview(s)}</div>
        </aside>
      </div>`,
  };
}

function readBrandingDraft() {
  const f = document.getElementById('branding-form').elements;
  return {
    businessName: f.businessName.value.trim(),
    accentColor: f.accentColor.value.trim().toLowerCase(),
    defaultWelcome: f.defaultWelcome.value.trim(),
    defaultApprovedWelcome: f.defaultApprovedWelcome.value.trim(),
    contactEmail: f.contactEmail.value.trim(),
    copyrightHolder: f.copyrightHolder.value.trim(),
    logo: editor.images.logo,
    previewImage: editor.images.previewImage,
  };
}

function brandingPreview(d) {
  const accent = isHexColor(d.accentColor) ? d.accentColor : settings().accentColor;
  const name = d.businessName || 'Business name';
  return html`<div class="brand-preview" style="${themeStyle(accent)}">
    <div class="bp-header">${logoMark(d.logo, name)}<span class="bp-name">${name}</span></div>
    <div class="bp-body">
      <p class="bp-title">Example signup page</p>
      <p>${d.defaultWelcome || 'Default welcome message'}</p>
      <span class="btn btn-primary bp-btn" aria-hidden="true">Try sample application</span>
      <p class="bp-approved"><strong>After approval:</strong> ${d.defaultApprovedWelcome || 'Approved-user welcome message'}</p>
    </div>
    <div class="bp-footer">© ${new Date().getFullYear()} ${d.copyrightHolder || 'Copyright holder'} · Contact: ${d.contactEmail || '—'}</div>
  </div>
  <p class="label bp-link-label">Default link preview</p>
  ${linkCard({ image: d.previewImage, title: `${name} employee signup`, description: 'Pages without their own image use this one.', address: exampleUrl('cashier'), name })}`;
}

/* =================================================================
   Admin: activity
   ================================================================= */
const ACTIVITY_TYPES = [
  ['all', 'All activity'],
  ['application', 'Applications'],
  ['employee', 'Employees'],
  ['page', 'Signup pages'],
  ['branding', 'Branding'],
];

function activityList(entries) {
  return html`<ol class="activity-list">${entries.map((x) => html`<li>
    <span class="activity-dot activity-${String(x.action).split('.')[0]}" aria-hidden="true"></span>
    <div><p class="activity-desc">${x.description}</p>
    <p class="activity-meta"><time datetime="${x.at}">${fmtDateTime(x.at)}</time> · ${x.actor}</p></div>
  </li>`)}</ol>`;
}

function filteredActivity() {
  const f = filters.activity;
  const q = f.q.trim().toLowerCase();
  return [...st().activity]
    .filter((x) => (f.type === 'all' || String(x.action).startsWith(`${f.type}.`)) && (!q || x.description.toLowerCase().includes(q)))
    .sort(newestFirst('at'));
}

function activityResults() {
  const list = filteredActivity();
  if (!list.length) {
    return emptyState('No activity matches', 'Try a different search or type.',
      html`<button type="button" class="btn btn-secondary" id="clear-activity" data-action="clear-filters" data-set="activity">Clear search and filters</button>`);
  }
  return html`<div class="card">${activityList(list)}</div>`;
}

function activityCount() {
  return `Showing ${plural(filteredActivity().length, 'entry', 'entries')}.`;
}

function activityView() {
  const f = filters.activity;
  return {
    title: 'Activity',
    layout: 'admin',
    nav: 'activity',
    body: html`
      ${pageHeader('Activity', 'A history of demo actions, newest first.')}
      <form class="filters card" role="search" aria-label="Filter activity" data-form="noop">
        <div class="field"><label for="activity-q">Search</label>
          <input type="search" id="activity-q" data-filter="activity.q" value="${f.q}" placeholder="Name, page, or action" autocomplete="off"></div>
        <div class="field"><label for="activity-type">Type</label>
          <select id="activity-type" data-filter="activity.type">${options(ACTIVITY_TYPES, f.type)}</select></div>
      </form>
      <p class="results-count" id="activity-count">${activityCount()}</p>
      <div id="activity-results">${activityResults()}</div>`,
  };
}

function adminNotFound(message) {
  return {
    title: 'Not found',
    layout: 'admin',
    nav: null,
    body: html`<section class="card prose not-found"><h1>Not found</h1><p>${message || 'This admin screen doesn’t exist.'}</p>
      <a class="btn btn-primary" href="#/admin">Go to overview</a></section>`,
  };
}

function errorView() {
  return {
    title: 'Something went wrong',
    layout: 'admin',
    nav: null,
    body: html`<section class="card prose not-found"><h1>Something went wrong</h1>
      <p>This screen couldn’t be displayed. The demo data may be in an unexpected state.</p>
      <div class="btn-row"><a class="btn btn-secondary" href="#/admin">Go to overview</a>
      <button type="button" class="btn btn-danger" data-action="reset-demo" id="error-reset">Reset demo</button></div></section>`,
  };
}

/* Last-resort screen that doesn't depend on the saved data. */
function fallbackScreen() {
  return html`<div class="demo-banner"><strong>Demo — sample data only</strong></div>
    <main id="main" class="public-main"><section class="card prose not-found"><h1>The demo couldn’t start</h1>
    <p>The saved demo data couldn’t be displayed. Resetting restores the original sample data.</p>
    <button type="button" class="btn btn-primary" data-action="reset-hard">Reset demo data</button></section></main>`;
}

/* =================================================================
   Routing and rendering
   ================================================================= */
function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function parseHash() {
  const [path, queryString = ''] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(safeDecode);
  return { parts, query: Object.fromEntries(new URLSearchParams(queryString)) };
}

function resolveView() {
  const { parts, query } = parseHash();
  const [a, b, c, d] = parts;
  if (!a) return homeView();
  if (a === 'join') return b && parts.length === 2 ? joinView(b) : notFoundView('A signup page address needs an ending, such as /join/cashier.');
  if (a === 'status' && parts.length <= 2) return statusView(b);
  if (parts.length === 1 && a === 'privacy') return privacyView();
  if (parts.length === 1 && a === 'terms') return termsView();
  if (parts.length === 1 && a === 'contact') return contactView();
  if (a === 'admin') {
    if (!b) return overviewView();
    if (b === 'applications') {
      if (!c) return applicationsView(query);
      if (!d) return applicationDetailView(c);
    }
    if (b === 'employees' && !c) return employeesView();
    if (b === 'pages') {
      if (!c) return pagesView();
      if (c === 'new' && !d) return pageEditorView(null);
      if (d === 'edit' && parts.length === 4) return pageEditorView(c);
    }
    if (b === 'branding' && !c) return brandingView();
    if (b === 'activity' && !c) return activityView();
    return adminNotFound();
  }
  return notFoundView();
}

function applyTheme() {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(themeVars(settings().accentColor))) root.setProperty(k, v);
}

/* opts.focus: selector to focus after render; opts.keepFocus: refocus the
   element with the same id. Without either, a route change focuses the h1. */
function render(opts = {}) {
  const root = document.getElementById('app');
  const prevId = opts.keepFocus && document.activeElement ? document.activeElement.id : '';
  const scrollY = window.scrollY;
  try {
    applyTheme();
    let view;
    try {
      view = resolveView();
    } catch (err) {
      console.error(err);
      view = errorView();
    }
    root.innerHTML = layout(view).s;
    document.title = `${view.title} · ${settings().businessName} (demo)`;
  } catch (err) {
    console.error(err);
    root.innerHTML = fallbackScreen().s;
  }
  root.removeAttribute('aria-busy');

  let target = null;
  if (opts.focus) target = document.querySelector(opts.focus);
  if (!target && prevId) target = document.getElementById(prevId);
  const inPlace = opts.focus || opts.keepFocus;
  if (!target && !firstRender) target = document.querySelector('main h1');
  if (target) {
    if (!target.matches('a, button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: !!inPlace });
  }
  if (inPlace) window.scrollTo(0, scrollY);
  else if (!firstRender) window.scrollTo(0, 0);
  firstRender = false;
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/* =================================================================
   Feedback: toasts, live regions, dialogs
   ================================================================= */
function announce(message, assertive = false) {
  const region = document.getElementById(assertive ? 'live-assertive' : 'live-polite');
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 60);
}

function toast(message, kind = 'success') {
  const region = document.getElementById('toast-region');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = html`<span class="toast-icon">${{ error: '!', info: 'i' }[kind] || '✓'}</span><span>${message}</span>`.s;
  region.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, kind === 'error' ? 8000 : 4500);
}

function notify(message, kind = 'success') {
  toast(message, kind);
  announce(message, kind === 'error');
}

const STORAGE_FULL_MESSAGE = 'Your change couldn’t be saved because this browser’s storage for the demo is full. The last saved version has been kept. Try a smaller image or remove one.';

/* Commit a change and report the result. Returns true on success. */
function save(mutate, message) {
  const result = commit(mutate);
  if (!result.ok) {
    notify(result.reason === 'quota' ? STORAGE_FULL_MESSAGE : 'Your change couldn’t be saved. Please try again.', 'error');
    return false;
  }
  if (message) notify(result.switchedToMemory ? `${message} Browser storage stopped working, so changes will disappear when you close this page.` : message);
  return true;
}

let dialogTrigger = null;
let dialogResolve = null;

function openDialog({ title, body, actions = [], wide = false }) {
  const d = document.getElementById('dialog');
  closeDialog('');
  return new Promise((resolve) => {
    dialogTrigger = document.activeElement;
    dialogResolve = resolve;
    d.className = wide ? 'dialog-wide' : '';
    d.innerHTML = html`<div class="dialog-inner">
      <div class="dialog-head"><h2 id="dialog-title">${title}</h2>
        <button type="button" class="icon-btn" data-dialog-value="" aria-label="Close">✕</button></div>
      <div class="dialog-body">${body}</div>
      ${actions.length ? html`<div class="dialog-actions">${actions.map((a) => html`<button type="button" class="btn ${a.variant || 'btn-secondary'}" data-dialog-value="${a.value}"${attrIf(a.autofocus, 'data-autofocus')}>${a.label}</button>`)}</div>` : ''}
    </div>`.s;
    d.returnValue = '';
    d.showModal();
    const first = d.querySelector('[data-autofocus]') || d.querySelector('.dialog-body button, .dialog-body input, .dialog-body select, .dialog-actions button');
    if (first) first.focus();
  });
}

/* Close the dialog, return focus to the control that opened it, and resolve
   the pending promise right away (without waiting for the async close event). */
function closeDialog(value) {
  const d = document.getElementById('dialog');
  if (d.open) d.close(value);
  const resolve = dialogResolve;
  dialogResolve = null;
  if (!resolve) return;
  if (dialogTrigger && document.contains(dialogTrigger)) dialogTrigger.focus();
  resolve(value);
}

function setupDialog() {
  const d = document.getElementById('dialog');
  d.addEventListener('click', (e) => {
    if (e.target === d) { closeDialog(''); return; } // backdrop click
    const btn = e.target.closest('[data-dialog-value]');
    if (btn) closeDialog(btn.dataset.dialogValue);
  });
  // Escape key
  d.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDialog('');
  });
  // Fallback for any other way the dialog gets closed.
  d.addEventListener('close', () => closeDialog(d.returnValue));
}

async function confirmDialog({ title, message, confirmLabel, danger = false }) {
  const value = await openDialog({
    title,
    body: message,
    actions: [
      { label: 'Cancel', value: 'cancel', autofocus: true },
      { label: confirmLabel, value: 'confirm', variant: danger ? 'btn-danger' : 'btn-primary' },
    ],
  });
  return value === 'confirm';
}

/* =================================================================
   Actions
   ================================================================= */
const actions = {
  'skip-to-main'() {
    const main = document.getElementById('main');
    if (main) main.focus();
  },

  'toggle-menu'(el) {
    menuOpen = !menuOpen;
    el.setAttribute('aria-expanded', String(menuOpen));
    document.getElementById('primary-nav').classList.toggle('open', menuOpen);
  },

  async 'reset-demo'() {
    const ok = await confirmDialog({
      title: 'Reset the demo?',
      message: html`<p>This replaces every change you’ve made — decisions, notes, signup pages, and branding — with the original sample data.</p><p>This can’t be undone.</p>`,
      confirmLabel: 'Reset demo',
      danger: true,
    });
    if (!ok) return;
    resetAll();
  },

  'reset-unreadable'() { resetAll(); },
  'reset-hard'() { resetAll(); },

  /* ----- public flow ----- */
  async 'choose-sample'(el) {
    const page = pageById(el.dataset.page);
    if (!page || page.status !== 'active') return;
    const emps = st().employees;
    const value = await openDialog({
      title: 'Choose a sample employee',
      wide: true,
      body: html`<p>Pick a predefined fictional employee. No real email address or password is needed.</p>
        <ul class="choice-list">${emps.map((e, i) => {
          const existing = st().applications.some((a) => a.employeeRef === e.id && a.pageId === page.id);
          return html`<li><button type="button" class="choice" data-dialog-value="${e.id}"${attrIf(i === 0, 'data-autofocus')}>
            <span class="choice-name">${e.name}</span>
            <span class="choice-meta">${e.employeeId} · ${e.email}</span>
            ${existing ? html`<span class="choice-note">Already applied here — opens their status</span>` : ''}
          </button></li>`;
        })}</ul>`,
      actions: [{ label: 'Cancel', value: '' }],
    });
    if (!value) return;
    const existing = st().applications.find((a) => a.employeeRef === value && a.pageId === page.id);
    if (existing) {
      flow = null;
      notify('This sample employee already has a demo application for this page. Showing its status.', 'info');
      navigate(`#/status/${value}`);
      return;
    }
    flow = { pageId: page.id, empId: value, step: 'verify', verifiedAt: null };
    render({ focus: '#flow-title' });
  },

  'simulate-verify'() {
    if (!flow) return;
    flow.step = 'review';
    flow.verifiedAt = nowIso();
    announce('Email verification simulated. No email was sent.');
    render({ focus: '#flow-title' });
  },

  'cancel-flow'() {
    flow = null;
    announce('Sample application cancelled.');
    render({ focus: '#try-sample' });
  },

  'submit-demo'() {
    if (!flow) return;
    const page = pageById(flow.pageId);
    const emp = empById(flow.empId);
    if (!page || !emp) { flow = null; render(); return; }
    if (page.status !== 'active') {
      flow = null;
      notify('This signup page is no longer accepting demo applications.', 'error');
      render();
      return;
    }
    if (st().applications.some((a) => a.employeeRef === emp.id && a.pageId === page.id)) {
      flow = null;
      navigate(`#/status/${emp.id}`);
      return;
    }
    const { verifiedAt } = flow;
    const ok = save((s) => {
      const app = {
        id: uid('app'), employeeRef: emp.id, pageId: page.id, requestedRole: page.role, status: 'pending',
        verifiedAt, submittedAt: nowIso(), decidedAt: null, notes: '',
      };
      s.applications.push(app);
      const e = s.employees.find((x) => x.id === emp.id);
      const hasApproved = s.applications.some((a) => a.employeeRef === e.id && a.status === 'approved');
      if (!hasApproved) e.role = page.role;
      addActivity(s, 'application.submit', app.id, `${e.name} submitted a demo application through ${page.title}.`, 'Sample applicant');
    }, 'Demo application submitted. No email was sent.');
    if (!ok) return;
    flow = null;
    navigate(`#/status/${emp.id}`);
  },

  /* ----- applications ----- */
  async decide(el) {
    const app = appById(el.dataset.app);
    const decision = el.dataset.decision;
    if (!app || !['approved', 'declined', 'pending'].includes(decision)) return;
    const emp = empById(app.employeeRef);
    const page = pageById(app.pageId);
    const prev = app.status;
    if (prev === 'approved' && decision === 'declined') {
      const ok = await confirmDialog({
        title: 'Change this approval to declined?',
        message: html`<p><strong>${emp.name}</strong> (${emp.email}) is currently approved for ${page.title}.</p>
          <p>If you continue, the application will be marked as declined. ${emp.name} will no longer appear in the Employees list (unless they have another approved application), and their status page will say the application was declined.</p>
          <p>This is a demo: no email is sent, and you can reverse this later.</p>`,
        confirmLabel: 'Change to declined',
        danger: true,
      });
      if (!ok) return;
    }
    const who = `${emp.name}’s application (${emp.employeeId}) for ${page.title}`;
    let action;
    let description;
    if (decision === 'approved') {
      action = 'application.approve';
      description = prev === 'declined' ? `Reversed the decline and approved ${who}.` : `Approved ${who}.`;
    } else if (decision === 'declined') {
      action = 'application.decline';
      description = prev === 'approved' ? `Changed ${who} from approved to declined.` : `Declined ${who}.`;
    } else {
      action = 'application.reopen';
      description = `Moved ${who} back to pending (it was ${prev}).`;
    }
    const ok = save((s) => {
      const a = s.applications.find((x) => x.id === app.id);
      a.status = decision;
      a.decidedAt = decision === 'pending' ? null : nowIso();
      addActivity(s, action, a.id, description);
    }, 'Demo decision saved. No email was sent.');
    if (ok) render({ focus: '#decision-heading' });
  },

  'save-role'(el) {
    const emp = empById(el.dataset.emp);
    const role = document.getElementById('assigned-role').value;
    if (!emp || !ROLES.includes(role)) return;
    if (changeRole(emp, role)) render({ keepFocus: true });
  },

  'save-note'(el) {
    const app = appById(el.dataset.app);
    if (!app) return;
    const note = document.getElementById('app-note').value.trim();
    if (note === app.notes) { notify('The note hasn’t changed.', 'info'); return; }
    const emp = empById(app.employeeRef);
    const ok = save((s) => {
      s.applications.find((x) => x.id === app.id).notes = note;
      addActivity(s, 'application.note', app.id, `${note ? 'Updated' : 'Cleared'} the private note on ${emp.name}’s application.`);
    }, 'Private note saved.');
    if (ok) render({ keepFocus: true });
  },

  /* ----- employees ----- */
  async 'change-role'(el) {
    const emp = empById(el.dataset.emp);
    if (!emp) return;
    const value = await openDialog({
      title: `Change role for ${emp.name}`,
      body: html`<div class="field"><label for="dialog-role">Role</label>
        <select id="dialog-role" data-autofocus>${options(ROLES.map((r) => [r, r]), emp.role)}</select>
        <p class="hint">Roles are descriptive labels in this prototype. They don’t unlock any external system.</p></div>`,
      actions: [{ label: 'Cancel', value: '' }, { label: 'Save role', value: 'save', variant: 'btn-primary' }],
    });
    if (value !== 'save') return;
    const role = document.getElementById('dialog-role').value;
    if (!ROLES.includes(role) || !changeRole(emp, role)) return;
    refreshResults('emps');
    const btn = document.getElementById(`role-${emp.id}`);
    if (btn) btn.focus();
  },

  'set-account'(el) {
    const emp = empById(el.dataset.emp);
    const to = el.dataset.to;
    if (!emp || !['active', 'disabled'].includes(to)) return;
    const ok = save((s) => {
      s.employees.find((x) => x.id === emp.id).accountStatus = to;
      addActivity(s, to === 'disabled' ? 'employee.disable' : 'employee.enable', emp.id,
        to === 'disabled' ? `Disabled ${emp.name}’s account (${emp.employeeId}).` : `Re-enabled ${emp.name}’s account (${emp.employeeId}).`);
    }, to === 'disabled' ? `${emp.name}’s account is now disabled. Their application history is kept.` : `${emp.name}’s account is approved again.`);
    if (!ok) return;
    refreshResults('emps');
    const btn = document.getElementById(`toggle-${emp.id}`) || document.getElementById('emps-q');
    if (btn) btn.focus();
  },

  'clear-filters'(el) {
    const set = el.dataset.set;
    Object.assign(filters[set], FILTER_DEFAULTS[set]);
    render({ focus: `#${set}-q` });
    announce('Search and filters cleared.');
  },

  /* ----- signup pages ----- */
  'page-status'(el) {
    const page = pageById(el.dataset.page);
    const to = el.dataset.to;
    if (!page || !PAGE_STATUSES.includes(to)) return;
    const from = page.status;
    const verb = to === 'archived' ? 'Archived'
      : to === 'active' ? 'Reactivated'
        : from === 'archived' ? 'Restored from the archive as paused:' : 'Paused';
    const ok = save((s) => {
      const p = s.pages.find((x) => x.id === page.id);
      p.status = to;
      p.updatedAt = nowIso();
      addActivity(s, 'page.status', p.id, from === 'archived'
        ? `Restored the ${p.title} signup page from the archive as paused.`
        : `${verb} the ${p.title} signup page.`);
    }, `${page.title} is now ${to}.`);
    if (ok) render({ focus: `#page-title-${page.id}` });
  },

  async 'copy-link'(el) {
    const page = pageById(el.dataset.page);
    if (!page) return;
    const url = demoUrl(page.slug);
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      notify(`Demo link copied for ${page.title}.`);
    } catch {
      await openDialog({
        title: 'Copy the demo link',
        body: html`<p>Your browser didn’t allow automatic copying. Select the link below and copy it manually.</p>
          <div class="field"><label for="manual-link">Demo link for ${page.title}</label>
          <input type="text" id="manual-link" readonly value="${url}" data-autofocus data-select-on-focus></div>`,
        actions: [{ label: 'Done', value: 'done', variant: 'btn-primary' }],
      });
    }
  },

  'remove-image'(el) {
    const key = el.dataset.key;
    editor.images[key] = null;
    updateImageField(key);
    updateLivePreview();
    markDirty();
    announce('Image removed. Save to keep this change.');
    const input = document.getElementById(`${key}-file`);
    if (input) input.focus();
  },

  'discard-branding'() {
    render({ focus: 'main h1' });
    announce('Unsaved branding changes discarded.');
  },

  'focus-field'(el) {
    const target = document.getElementById(el.dataset.target);
    if (target) target.focus();
  },
};

function resetAll() {
  resetDemo();
  flow = null;
  filters.apps = { ...FILTER_DEFAULTS.apps, status: 'pending' };
  filters.emps = { ...FILTER_DEFAULTS.emps };
  filters.activity = { ...FILTER_DEFAULTS.activity };
  notify('Demo reset. The original sample data is back.');
  navigate('#/admin');
}

function changeRole(emp, role) {
  if (emp.role === role) {
    notify('The role hasn’t changed.', 'info');
    return false;
  }
  return save((s) => {
    s.employees.find((x) => x.id === emp.id).role = role;
    addActivity(s, 'employee.role', emp.id, `Changed ${emp.name}’s role from ${emp.role} to ${role}.`);
  }, `Demo change saved: ${emp.name} is now ${role === 'Accountant' ? 'an' : 'a'} ${role}.`);
}

/* ---------- Search and filters ---------- */
const RESULTS = {
  apps: [appsResults, appsCount],
  emps: [empsResults, empsCount],
  activity: [activityResults, activityCount],
};

let countTimer = null;
function refreshResults(set) {
  const [results, count] = RESULTS[set];
  const box = document.getElementById(`${set}-results`);
  const countEl = document.getElementById(`${set}-count`);
  if (!box || !countEl) return;
  box.innerHTML = results().s;
  countEl.textContent = count();
  clearTimeout(countTimer);
  countTimer = setTimeout(() => announce(countEl.textContent), 600);
}

function onFilterInput(el) {
  const [set, key] = el.dataset.filter.split('.');
  filters[set][key] = el.value;
  refreshResults(set);
}

/* ---------- Editors ---------- */
function markDirty() {
  const flag = document.getElementById('unsaved-flag');
  if (flag) flag.hidden = false;
}

function updateLivePreview() {
  if (!editor) return;
  if (editor.kind === 'page') {
    const box = document.getElementById('link-preview');
    if (box) box.innerHTML = pageEditorPreview().s;
  } else {
    const box = document.getElementById('brand-preview');
    if (box) box.innerHTML = brandingPreview(readBrandingDraft()).s;
  }
}

function updateImageField(key) {
  const wrap = document.querySelector(`[data-image-field="${key}"]`);
  if (!wrap) return;
  const useDefault = editor.kind === 'page' && editor.useDefault[key];
  const src = useDefault ? settings()[key] : editor.images[key];
  const label = wrap.querySelector('.label').textContent.toLowerCase();
  wrap.querySelector('.thumb').innerHTML = thumbHtml(src, label, useDefault ? 'Business default' : '').s;
  wrap.querySelector('[data-action="remove-image"]').disabled = useDefault || !editor.images[key];
  const tag = wrap.querySelector('.override-tag');
  if (tag) {
    tag.textContent = useDefault ? 'Using business default' : 'Custom for this page';
    tag.classList.toggle('is-custom', !useDefault);
  }
  const box = wrap.querySelector('[data-override-toggle]');
  if (box) box.checked = useDefault;
}

/* Image file inputs ("logo-file") share their widget's error element ("logo-error"). */
function setFieldError(id, message) {
  const field = document.getElementById(id);
  const err = document.getElementById(`${id.replace(/-file$/, '')}-error`);
  if (field) {
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
  if (err) {
    err.textContent = message || '';
    err.hidden = !message;
  }
}

async function onImageChosen(input) {
  const key = input.dataset.imageInput;
  const file = input.files && input.files[0];
  if (!file) return;
  const result = await readImageFile(file);
  input.value = '';
  if (!result.ok) {
    setFieldError(input.id, result.error);
    announce(result.error, true);
    return;
  }
  setFieldError(input.id, '');
  editor.images[key] = result.dataUrl;
  if (editor.kind === 'page') editor.useDefault[key] = false;
  updateImageField(key);
  updateLivePreview();
  markDirty();
  announce('Image added to the preview. Save to keep it.');
}

function onOverrideToggle(box) {
  const name = box.dataset.overrideToggle;
  const useDefault = box.checked;
  if (name === 'logo' || name === 'previewImage') {
    editor.useDefault[name] = useDefault;
    updateImageField(name);
  } else {
    const wrap = box.closest('[data-override]');
    const ta = wrap.querySelector('textarea');
    const tag = wrap.querySelector('.override-tag');
    tag.textContent = useDefault ? 'Using business default' : 'Custom for this page';
    tag.classList.toggle('is-custom', !useDefault);
    if (useDefault) {
      ta.dataset.custom = ta.value;
      ta.value = name === 'welcome' ? settings().defaultWelcome : settings().defaultApprovedWelcome;
      ta.disabled = true;
      setFieldError(ta.id, '');
    } else {
      ta.disabled = false;
      if (ta.dataset.custom !== undefined) ta.value = ta.dataset.custom;
      ta.focus();
    }
  }
  updateLivePreview();
}

function showFormErrors(errors) {
  const summary = document.getElementById('form-errors');
  document.querySelectorAll('[aria-invalid="true"]').forEach((el) => setFieldError(el.id, ''));
  if (!errors.length) {
    summary.hidden = true;
    summary.innerHTML = '';
    return;
  }
  errors.forEach(({ field, message }) => setFieldError(field, message));
  summary.innerHTML = html`<p class="error-summary-title">Please fix ${plural(errors.length, 'problem', 'problems')} before saving:</p>
    <ul>${errors.map(({ field, message }) => html`<li><button type="button" class="link-button" data-action="focus-field" data-target="${field}">${message}</button></li>`)}</ul>`.s;
  summary.hidden = false;
  summary.focus();
  announce(`${plural(errors.length, 'problem', 'problems')} to fix. ${errors.map((e) => e.message).join(' ')}`, true);
}

function submitPageForm(form) {
  const f = form.elements;
  const isNew = !editor.pageId;
  const existing = isNew ? null : pageById(editor.pageId);
  if (!isNew && !existing) { navigate('#/admin/pages'); return; }
  const v = {
    title: f.title.value.trim(),
    slug: f.slug.value.trim(),
    role: f.role.value,
    status: f.status.value,
    roleDescription: f.roleDescription.value.trim(),
    welcome: f.welcome__default.checked ? null : f.welcome.value.trim(),
    approvedWelcome: f.approvedWelcome__default.checked ? null : f.approvedWelcome.value.trim(),
    previewTitle: f.previewTitle.value.trim(),
    previewDescription: f.previewDescription.value.trim(),
    logo: editor.useDefault.logo ? null : editor.images.logo,
    previewImage: editor.useDefault.previewImage ? null : editor.images.previewImage,
  };

  const errors = [];
  if (!v.title) errors.push({ field: 'pf-title', message: 'Enter a display title.' });
  const slugError = slugProblem(v.slug, st(), editor.pageId);
  if (slugError) errors.push({ field: 'pf-slug', message: slugError });
  if (v.welcome === '') errors.push({ field: 'pf-welcome', message: 'Enter a welcome message, or select Use business default.' });
  if (v.approvedWelcome === '') errors.push({ field: 'pf-approved', message: 'Enter an approved-user welcome message, or select Use business default.' });
  if (!editor.useDefault.logo && !editor.images.logo) errors.push({ field: 'logo-file', message: 'Upload a logo for this page, or select Use business default.' });
  if (!editor.useDefault.previewImage && !editor.images.previewImage) errors.push({ field: 'previewImage-file', message: 'Upload a link preview image, or select Use business default.' });
  if (!ROLES.includes(v.role) || !PAGE_STATUSES.includes(v.status)) errors.push({ field: 'pf-role', message: 'Choose a role and status.' });
  showFormErrors(errors);
  if (errors.length) return;

  const ts = nowIso();
  const ok = save((s) => {
    if (isNew) {
      const page = { id: uid('page'), aliases: [], createdAt: ts, updatedAt: ts, ...v };
      s.pages.push(page);
      addActivity(s, 'page.create', page.id, `Created the ${page.title} signup page.`);
      return;
    }
    const p = s.pages.find((x) => x.id === existing.id);
    if (p.slug !== v.slug) {
      if (!p.aliases.includes(p.slug)) p.aliases.push(p.slug);
      p.aliases = p.aliases.filter((a) => a !== v.slug);
      addActivity(s, 'page.rename', p.id, `Changed the ${v.title} address from “${p.slug}” to “${v.slug}”. The old address still works.`);
    }
    if (p.status !== v.status) {
      addActivity(s, 'page.status', p.id, `Changed the ${v.title} signup page from ${p.status} to ${v.status}.`);
    }
    Object.assign(p, v, { updatedAt: ts });
    addActivity(s, 'page.update', p.id, `Edited the ${p.title} signup page.`);
  }, isNew ? `Signup page “${v.title}” created.` : `Signup page “${v.title}” saved.`);
  if (ok) navigate('#/admin/pages');
}

function submitBrandingForm() {
  const d = readBrandingDraft();
  const errors = [];
  if (!d.businessName) errors.push({ field: 'bf-name', message: 'Enter a business name.' });
  if (!isHexColor(d.accentColor)) errors.push({ field: 'bf-accent', message: 'Enter the accent colour as a hex value, such as #4f46e5.' });
  if (!d.defaultWelcome) errors.push({ field: 'bf-welcome', message: 'Enter a default welcome message.' });
  if (!d.defaultApprovedWelcome) errors.push({ field: 'bf-approved', message: 'Enter a default approved-user welcome message.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contactEmail)) errors.push({ field: 'bf-contact', message: 'Enter a contact email address, such as people@teamgate.example.' });
  if (!d.copyrightHolder) errors.push({ field: 'bf-copy', message: 'Enter a footer copyright holder.' });
  showFormErrors(errors);
  if (errors.length) return;

  const ok = save((s) => {
    Object.assign(s.settings, d);
    addActivity(s, 'branding.update', 'settings', 'Updated the business branding settings.');
  }, 'Branding saved.');
  if (ok) {
    render({ focus: 'main h1' });
  } else {
    // Storage full: keep the person's edits on screen, explain in the form too.
    const summary = document.getElementById('form-errors');
    summary.innerHTML = html`<p class="error-summary-title">Branding wasn’t saved</p><p>${STORAGE_FULL_MESSAGE}</p>`.s;
    summary.hidden = false;
    summary.focus();
  }
}

/* =================================================================
   Event wiring
   ================================================================= */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  if (el.disabled) return;
  e.preventDefault();
  Promise.resolve(actions[el.dataset.action](el, e)).catch((err) => {
    console.error(err);
    notify('Something went wrong with that action. Please try again.', 'error');
  });
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.filter) { onFilterInput(el); return; }
  if (el.dataset.sync === 'accent-picker') {
    document.getElementById('bf-accent').value = el.value;
    setFieldError('bf-accent', '');
  }
  if (el.dataset.sync === 'accent-text' && isHexColor(el.value.trim())) {
    document.getElementById('bf-accent-picker').value = el.value.trim().toLowerCase();
  }
  if (el.id === 'pf-slug') editor.slugTouched = true;
  if (el.id === 'pf-title' && editor && !editor.slugTouched) {
    document.getElementById('pf-slug').value = slugify(el.value);
  }
  if (el.closest('#page-form, #branding-form')) {
    if (el.getAttribute('aria-invalid') === 'true') setFieldError(el.id, '');
    markDirty();
    updateLivePreview();
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.imageInput) { onImageChosen(el); return; }
  if (el.dataset.overrideToggle) { onOverrideToggle(el); return; }
  if (el.dataset.change === 'pick-account') navigate(`#/status/${el.value}`);
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  e.preventDefault();
  if (form.dataset.form === 'page') submitPageForm(form);
  if (form.dataset.form === 'branding') submitBrandingForm();
});

document.addEventListener('focusin', (e) => {
  if (e.target.matches && e.target.matches('[data-select-on-focus]')) e.target.select();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen && !document.getElementById('dialog').open) {
    const toggle = document.getElementById('menu-toggle');
    if (toggle && getComputedStyle(toggle).display !== 'none') {
      actions['toggle-menu'](toggle);
      toggle.focus();
    }
  }
});

window.addEventListener('hashchange', () => {
  menuOpen = false;
  closeDialog('');
  render();
});

// Keep several open tabs of the demo in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY && e.key !== null) return;
  loadState();
  render({ keepFocus: true });
});

setupDialog();
loadState();
render();
