# TeamGate — Employee Portal Prototype

> **Demo — sample data only.** This is a design and interaction prototype. Every person, email address, and employee ID is fictional, and every action is simulated.

TeamGate shows how a business could review employee account applications and manage several branded signup pages. It's a static website (HTML, CSS, and JavaScript, with no build step). It runs entirely in your browser.

**What it never does:** collect passwords or verification codes, send email, sign anyone in, connect to a database, or submit anything to a server. It loads no external fonts or scripts.

## Opening the demo

**Option 1: open the file.** Double-click `index.html`. Everything works from `file://`, because the demo uses hash routes such as `#/join/cashier` and needs no server.

**Option 2: run a tiny local server** (recommended if your browser blocks storage for local files):

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## A five-minute tour

1. **Public page previews** (`#/`): pick **Cashier team** and select **Try sample application**.
2. Choose a fictional sample employee, select **Simulate verified email** (no email is sent), review the summary, then **Submit demo application**.
3. You land on that employee's **status page**, showing *"Your application is waiting for review."*
4. Select **Open admin demo**. The **Overview** shows the new pending application.
5. Open it in **Applications**, approve or decline it, change the role, and add a private note. Then check **Employee preview** again: the status has changed, and the private note is nowhere to be seen.
6. Try **Employees** (change roles, disable and re-enable), **Signup pages** (create, rename, pause, archive, restore, copy demo link), and **Branding** (live preview before saving).
7. Open `#/join/cashiers`. That's an old address of the Cashier page, and it still works.

## Screens

| Section | Route | What it shows |
| --- | --- | --- |
| Overview | `#/admin` | Four summary counts, recent pending applications, latest activity |
| Applications | `#/admin/applications` | Search and filter by status, page, and role; details at `#/admin/applications/<id>` |
| Employees | `#/admin/employees` | Approved and disabled employees; role changes; disable or re-enable |
| Signup pages | `#/admin/pages` | Manage pages; editor at `#/admin/pages/new` and `#/admin/pages/<id>/edit` |
| Branding | `#/admin/branding` | Business-wide settings with a live preview |
| Activity | `#/admin/activity` | Full history of demo actions |
| Employee preview | `#/status/<employee>` | What a sample employee sees (no sign-in) |
| Public signup page | `#/join/<address-ending>` | A branded signup page; old endings still resolve |
| Privacy, Terms, Contact | `#/privacy`, `#/terms`, `#/contact` | Informational pages |

The addresses shown as `https://portal.example/join/...` are **examples only**. They are not registered or published.

## Saving and resetting

- Demo edits are saved in this browser's `localStorage` under the key `teamgate-demo-state`, so they survive a refresh. Nothing leaves the device.
- **Reset demo** (bottom of the admin sidebar) asks for confirmation, then restores the original sample data.
- If saved data can't be read, the demo shows the original sample data and offers **Reset saved demo data**. It never shows a blank screen.
- If browser storage is unavailable, such as in some private windows, the demo keeps working in memory and tells you that changes will disappear when you close the page.
- Images (PNG, JPEG, or WebP, up to 2 MB) are stored in the browser too. If storage is full, the last saved version is kept and the demo explains why.

To clear everything manually, remove this site's data in your browser settings.

## Starting sample data

- **Signup pages:** Cashier team (active, with the old address `cashiers`), Management team (active), and Accounting team (paused).
- **Six fictional employees** at `teamgate.example`: two pending, two approved, one declined, and one disabled.
- **Roles:** Cashier, Manager, and Accountant. These are descriptive labels only and don't unlock any external system.

## Project structure

```
index.html       Page shell and live regions for screen readers
css/styles.css   All styles (system fonts, indigo accent, responsive)
js/util.js       Safe templating (all text escaped), colours, image validation
js/data.js       Versioned data model, sample content, validation rules
js/store.js      Browser-storage persistence and reset
js/app.js        Routing, screens, actions, accessibility helpers
```

## Accessibility

The demo is fully usable with a keyboard and shows visible focus indicators. Every control has a label. Dialogs move focus inside, close with Escape, and return focus to the button that opened them. Save results and validation errors are announced to screen readers. Animations respect reduced-motion settings. Status labels always combine text, a symbol, and colour.

## Production boundary

This prototype must not be presented as, or reused for, a production employee system. Demo approval buttons and browser storage are **not** security controls. A real system would need a separately agreed specification covering identity verification, server-enforced permissions, database access controls, email delivery, administrator setup, domain ownership, privacy requirements, and deployment.

TeamGate is a sample business name. This demo is not affiliated with any other company.
