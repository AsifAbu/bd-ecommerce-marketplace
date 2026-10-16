// Builds the use case diagrams (SVG -> PNG) and the Word document.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  PageOrientation, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, Footer, PageNumber,
} = require('docx');

const OUT_DIR = process.argv[2];
// Diagrams are rendered into a temp folder so this folder stays clean.
const SCRATCH = path.join(require('os').tmpdir(), 'ecom-plan-build');
fs.mkdirSync(SCRATCH, { recursive: true });

// ---------- SVG drawing helpers ----------
const FONT = "Helvetica, Arial, sans-serif";
const INK = '#1f2328', LINE = '#57606a', FILL = '#eef4fb', STROKE = '#2f6fb5';

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function edgePoint(cx, cy, rx, ry, tx, ty) {
  const dx = tx - cx, dy = ty - cy;
  const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  return [cx + dx * t, cy + dy * t];
}

class Diagram {
  constructor(w, h, title) { this.w = w; this.h = h; this.parts = []; this.uc = {}; this.actors = {};
    this.parts.push(`<rect width="${w}" height="${h}" fill="#ffffff"/>`);
    this.parts.push(`<text x="40" y="52" font-size="26" font-weight="700" fill="${INK}">${esc(title)}</text>`);
  }
  boundary(x, y, w, h, name) {
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${INK}" stroke-width="2"/>`);
    this.parts.push(`<text x="${x + w / 2}" y="${y + 32}" font-size="20" font-weight="700" text-anchor="middle" fill="${INK}">${esc(name)}</text>`);
  }
  actor(id, x, y, name, stereo) {
    this.actors[id] = { x, y };
    const p = this.parts;
    p.push(`<g stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round">`
      + `<circle cx="${x}" cy="${y - 50}" r="14" fill="#fff"/>`
      + `<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y + 6}"/>`
      + `<line x1="${x - 24}" y1="${y - 22}" x2="${x + 24}" y2="${y - 22}"/>`
      + `<line x1="${x}" y1="${y + 6}" x2="${x - 18}" y2="${y + 36}"/>`
      + `<line x1="${x}" y1="${y + 6}" x2="${x + 18}" y2="${y + 36}"/></g>`);
    let ty = y + 60;
    if (stereo) { p.push(`<text x="${x}" y="${ty}" font-size="14" text-anchor="middle" fill="${LINE}">«${esc(stereo)}»</text>`); ty += 20; }
    p.push(`<text x="${x}" y="${ty}" font-size="17" font-weight="700" text-anchor="middle" fill="${INK}">${esc(name)}</text>`);
  }
  useCase(id, cx, cy, label, rx = 140, ry = 30) {
    this.uc[id] = { cx, cy, rx, ry };
    this.parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.8"/>`);
    this.parts.push(`<text x="${cx}" y="${cy + 5.5}" font-size="16" text-anchor="middle" fill="${INK}">${esc(label)}</text>`);
  }
  // Solid association line from actor to use case.
  assoc(actorId, ucId) {
    const a = this.actors[actorId], u = this.uc[ucId];
    const ax = u.cx > a.x ? a.x + 30 : a.x - 30, ay = a.y - 14;
    // Attach at the oval's near side so lines never cut through neighbouring ovals.
    const ex = u.cx > a.x ? u.cx - u.rx : u.cx + u.rx, ey = u.cy;
    this.parts.push(`<line x1="${ax}" y1="${ay}" x2="${ex}" y2="${ey}" stroke="${LINE}" stroke-width="1.6"/>`);
  }
  // Dashed dependency arrow between use cases, labelled «include» / «extend».
  dep(fromId, toId, kind, labelDx = 0, labelDy = -8) {
    const f = this.uc[fromId], t = this.uc[toId];
    const [sx, sy] = edgePoint(f.cx, f.cy, f.rx, f.ry, t.cx, t.cy);
    const [ex, ey] = edgePoint(t.cx, t.cy, t.rx, t.ry, f.cx, f.cy);
    this.parts.push(`<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${LINE}" stroke-width="1.6" stroke-dasharray="8 6" marker-end="url(#open)"/>`);
    const mx = (sx + ex) / 2 + labelDx, my = (sy + ey) / 2 + labelDy;
    this.parts.push(`<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-size="14" font-style="italic" text-anchor="middle" fill="${LINE}">«${kind}»</text>`);
  }
  // Generalisation: child actor -> parent actor, hollow triangle at the parent.
  generalize(childId, parentId) {
    const c = this.actors[childId], p = this.actors[parentId];
    const down = c.y > p.y;
    const y1 = down ? c.y - 66 : c.y + 70;
    const y2 = down ? p.y + 70 : p.y - 66;
    this.parts.push(`<line x1="${c.x}" y1="${y1}" x2="${p.x}" y2="${y2}" stroke="${INK}" stroke-width="1.8" marker-end="url(#tri)"/>`);
  }
  note(x, y, w, lines) {
    const h = 24 + lines.length * 22;
    this.parts.push(`<path d="M${x} ${y}H${x + w - 18}L${x + w} ${y + 18}V${y + h}H${x}Z" fill="#fff8e1" stroke="${LINE}" stroke-width="1.4"/>`
      + `<path d="M${x + w - 18} ${y}V${y + 18}H${x + w}" fill="none" stroke="${LINE}" stroke-width="1.4"/>`);
    lines.forEach((l, i) => this.parts.push(`<text x="${x + 16}" y="${y + 28 + i * 22}" font-size="15" fill="${INK}">${esc(l)}</text>`));
  }
  svg() {
    const defs = `<defs>`
      + `<marker id="open" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto"><path d="M1 1L11 6L1 11" fill="none" stroke="${LINE}" stroke-width="1.6"/></marker>`
      + `<marker id="tri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="16" markerHeight="16" orient="auto"><path d="M1 1L13 7L1 13Z" fill="#ffffff" stroke="${INK}" stroke-width="1.4"/></marker>`
      + `</defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" font-family="${FONT}">${defs}${this.parts.join('')}</svg>`;
  }
}

// ---------- Diagram 1: Shopping ----------
function shoppingDiagram() {
  const d = new Diagram(1460, 1400, 'Diagram 1 - Shopping, guest checkout and try-on');
  d.boundary(300, 80, 900, 1290, 'Multi-Vendor E-Commerce Platform (Bangladesh)');
  const L = 520, R = 940;
  d.useCase('browse', L, 160, 'Browse categories');
  d.useCase('search', L, 230, 'Search products');
  d.useCase('view', L, 300, 'View product details');
  d.useCase('store', L, 370, 'View shop storefront');
  d.useCase('cart', L, 440, 'Manage cart');
  d.useCase('checkout', L, 510, 'Checkout (cash on delivery)');
  d.useCase('track', L, 580, 'Track order, return, complain');
  d.useCase('login', L, 690, 'Register / log in');
  d.useCase('profile', L, 760, 'Manage profile and addresses');
  d.useCase('orders', L, 830, 'See all orders (guest ones linked)');
  d.useCase('wishlist', L, 900, 'Manage wishlist');
  d.useCase('review', L, 970, 'Rate and review product');
  d.useCase('upload', L, 1110, 'Upload try-on photo');
  d.useCase('tryon', L, 1180, 'Try on garment');
  d.useCase('deltryon', L, 1250, 'Delete try-on photos and results');

  d.useCase('populated', R, 160, 'See only populated categories', 160);
  d.useCase('filter', R, 230, 'Filter by category attributes', 160);
  d.useCase('address', R, 470, 'Give contact and address', 150);
  d.useCase('otp', R, 550, 'Verify mobile by OTP', 150);
  d.useCase('validate', R, 1080, 'Validate full-body photo', 150);
  d.useCase('generate', R, 1230, 'Generate try-on image', 150);

  d.actor('guest', 140, 375, 'Guest shopper');
  d.actor('customer', 140, 930, 'Customer');
  d.actor('provider', 1340, 1230, 'Try-on provider', 'system');

  ['browse', 'search', 'view', 'store', 'cart', 'checkout', 'track'].forEach(u => d.assoc('guest', u));
  ['login', 'profile', 'orders', 'wishlist', 'review', 'upload', 'tryon', 'deltryon'].forEach(u => d.assoc('customer', u));
  d.generalize('customer', 'guest');

  d.dep('browse', 'populated', 'include');
  d.dep('filter', 'search', 'extend');
  d.dep('checkout', 'address', 'include', 0, -10);
  d.dep('checkout', 'otp', 'include', 0, 24);
  d.dep('upload', 'validate', 'include', 0, -10);
  d.dep('tryon', 'validate', 'include', 0, 24);
  d.dep('tryon', 'generate', 'include', 0, 24);

  // External system actor talks to the generation use case.
  const g = d.uc.generate, p = d.actors.provider;
  d.parts.push(`<line x1="${g.cx + g.rx}" y1="${g.cy}" x2="${p.x - 30}" y2="${g.cy}" stroke="${LINE}" stroke-width="1.6"/>`);
  return d.svg();
}

// ---------- Diagram 2: Shop and platform management ----------
function managementDiagram() {
  const d = new Diagram(1460, 1420, 'Diagram 2 - Shop and platform management');
  d.boundary(290, 80, 960, 1180, 'Multi-Vendor E-Commerce Platform (Bangladesh)');
  const L = 470, M = 790, A = 1090;
  // Shift every use case below the boundary title.
  const place = d.useCase.bind(d);
  d.useCase = (id, cx, cy, label, rx) => place(id, cx, cy + 50, label, rx);
  d.useCase('add', L, 150, 'Add product');
  d.useCase('edit', L, 225, 'Edit or deactivate product');
  d.useCase('stock', L, 300, 'Manage stock and prices');
  d.useCase('fulfil', L, 375, 'Hand over orders (48 h)');
  d.useCase('returns', L, 450, 'Handle returns');
  d.useCase('respond', L, 525, 'Respond to complaints');
  d.useCase('request', L, 600, 'Request category (24 h reply)');
  d.useCase('csv', L, 675, 'Bulk upload products (CSV)');
  d.useCase('apply', L, 785, 'Apply to open shop (Basic)');
  d.useCase('upgrade', L, 860, 'Upgrade to Verified seller');
  d.useCase('shopprofile', L, 935, 'Manage shop profile');
  d.useCase('share', L, 1010, 'Share storefront link');
  d.useCase('staff', L, 1085, 'Manage shop staff');
  d.useCase('sales', L, 1160, 'View sales and COD payouts');

  d.useCase('form', M, 125, 'Fill category attribute form', 160);
  d.useCase('garment', M, 240, 'Upload garment image', 140);
  d.useCase('verify', M, 400, 'Verify drug licence', 140);
  d.useCase('licence', M, 785, 'Upload drug licence', 140);

  d.useCase('approve', A, 330, 'Approve or suspend shops', 145);
  d.useCase('tree', A, 405, 'Manage category tree', 145);
  d.useCase('attrs', A, 480, 'Manage attributes, options', 145);
  d.useCase('review', A, 555, 'Review category requests', 145);
  d.useCase('users', A, 630, 'Manage users and roles', 145);
  d.useCase('moderate', A, 705, 'Moderate products, reviews', 145);
  d.useCase('policies', A, 780, 'Publish policy pages', 145);
  d.useCase('rates', A, 855, 'Set delivery charges', 145);
  d.useCase('resolve', A, 930, 'Resolve complaints (72 h)', 145);
  d.useCase('metrics', A, 1005, 'View marketplace metrics', 145);

  d.actor('staffA', 130, 460, 'Shop Staff');
  d.actor('owner', 130, 1020, 'Shop Owner');
  d.actor('admin', 1370, 680, 'Platform Admin');

  ['add', 'edit', 'stock', 'fulfil', 'returns', 'respond', 'request', 'csv'].forEach(u => d.assoc('staffA', u));
  ['apply', 'upgrade', 'shopprofile', 'share', 'staff', 'sales'].forEach(u => d.assoc('owner', u));
  ['approve', 'tree', 'attrs', 'review', 'users', 'moderate', 'policies', 'rates', 'resolve', 'metrics'].forEach(u => d.assoc('admin', u));
  d.generalize('owner', 'staffA');

  d.dep('add', 'form', 'include', -20, -18);
  d.dep('garment', 'add', 'extend', 10, 22);
  d.dep('licence', 'apply', 'extend', 0, -10);
  d.dep('verify', 'approve', 'extend', -50, -8);

  d.note(300, 1280, 900, [
    'Shop Owner inherits every Shop Staff use case. Every role is also a Customer and has the use cases in Diagram 1.',
    'Upload and Verify drug licence apply only to medicine shops. Upload garment image applies only to tops and bottoms.',
  ]);
  return d.svg();
}

function render(svg, name) {
  fs.writeFileSync(path.join(SCRATCH, name + '.svg'), svg);
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 }, font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' } }).render().asPng();
  fs.writeFileSync(path.join(SCRATCH, name + '.png'), png);
  return { svg: Buffer.from(svg), png };
}

// ---------- Word document ----------
const PAGE_W = 16838, MARGIN = 1000;
const CONTENT_W = PAGE_W - 2 * MARGIN; // DXA, landscape A4

function img(r, w, h, maxH) {
  const maxW = Math.floor((CONTENT_W / 1440) * 96);
  const s = Math.min(maxW / w, maxH / h);
  return new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({
    type: 'svg', data: r.svg, fallback: { type: 'png', data: r.png },
    transformation: { width: Math.round(w * s), height: Math.round(h * s) },
    altText: { title: 'Use case diagram', description: 'UML use case diagram', name: 'diagram' },
  })] });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFC5CC' };
const borders = { top: border, bottom: border, left: border, right: border };
function table(widths, rows) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, children: r.map((c, j) => new TableCell({
      borders, width: { size: widths[j], type: WidthType.DXA },
      shading: i === 0 ? { fill: 'DCE8F5', type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: i === 0, size: 19 })] })],
    })) })),
  });
}
const p = text => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 21 })] });
const caption = text => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new TextRun({ text, italics: true, size: 18, color: '57606A' })] });

const d1 = render(shoppingDiagram(), 'diagram1');
const d2 = render(managementDiagram(), 'diagram2');

const actorsRows = [
  ['Actor', 'Type', 'Description'],
  ['Guest shopper', 'Primary, human', 'Not logged in. Can browse, search, filter, use the cart, check out with cash on delivery (mobile OTP and email) and track orders by order number plus OTP.'],
  ['Customer', 'Primary, human (specialises Guest shopper)', 'Logged in with mobile or email. Sees all orders including linked guest orders, uses wishlist, reviews and try-on.'],
  ['Shop Staff', 'Primary, human', 'Works for one shop. Lists products, manages stock and fulfils orders.'],
  ['Shop Owner', 'Primary, human (specialises Shop Staff)', 'Organization admin of one shop. Runs the shop and manages its staff.'],
  ['Platform Admin', 'Primary, human', 'Holds all power. Approves shops, owns the category schema, manages users.'],
  ['Try-on provider', 'Secondary, external system', 'AI service that generates the try-on image from the user photo and garment image.'],
];

const ucRows = [
  ['ID', 'Use case', 'Actor', 'Relationships', 'Story'],
  ['UC-01', 'Browse categories', 'Guest', '«include» See only populated categories', 'US-040'],
  ['UC-02', 'Search products', 'Guest', 'Extended by Filter by category attributes', 'US-041'],
  ['UC-03', 'Filter by category attributes', 'Guest', '«extend» Search products', 'US-042'],
  ['UC-04', 'View product details', 'Guest', '-', 'US-044'],
  ['UC-05', 'Manage cart', 'Guest shopper', '-', 'US-050, 056'],
  ['UC-06', 'Checkout (cash on delivery)', 'Guest shopper', '«include» Give contact and address, Verify mobile by OTP', 'US-005, 007, 051'],
  ['UC-07', 'Track order, return, complain', 'Guest shopper', 'Order number plus OTP for guests', 'US-008, 052, 070, 072'],
  ['UC-08', 'Register / log in (mobile or email)', 'Customer (required for every other role)', '-', 'US-001, 003'],
  ['UC-09', 'Manage profile and addresses', 'Customer (all roles)', '-', 'US-002, 006'],
  ['UC-10', 'See all orders (guest ones linked)', 'Customer', 'Guest orders attach through a verified mobile or email', 'US-009, 052'],
  ['UC-11', 'Manage wishlist', 'Customer', '-', 'US-057'],
  ['UC-12', 'Rate and review product', 'Customer', '-', 'US-055'],
  ['UC-13', 'Request return or complain (logged in)', 'Customer', '-', 'US-070, 072'],
  ['UC-14', 'Upload try-on photo', 'Customer', '«include» Validate full-body photo', 'US-060'],
  ['UC-15', 'Try on garment', 'Customer', '«include» Validate full-body photo, Generate try-on image', 'US-062'],
  ['UC-16', 'Add product', 'Shop Staff', '«include» Fill category attribute form; extended by Upload garment image', 'US-030, 031, 032'],
  ['UC-17', 'Upload garment image', 'Shop Staff', '«extend» Add product (try-on categories only)', 'US-061'],
  ['UC-18', 'Edit or deactivate product', 'Shop Staff', '-', 'US-033'],
  ['UC-19', 'Manage stock and prices', 'Shop Staff', '-', 'US-033'],
  ['UC-20', 'Hand over orders (48 h)', 'Shop Staff', '-', 'US-053'],
  ['UC-21', 'Handle returns', 'Shop Staff', '-', 'US-071'],
  ['UC-22', 'Respond to complaints', 'Shop Staff', '-', 'US-072'],
  ['UC-23', 'Request new category', 'Shop Staff', '-', 'US-022'],
  ['UC-24', 'Apply to open shop', 'Shop Owner', 'Extended by Upload drug licence', 'US-010'],
  ['UC-25', 'Upload drug licence', 'Shop Owner', '«extend» Apply to open shop (medicine shops only)', 'US-015'],
  ['UC-26', 'Manage shop profile', 'Shop Owner', '-', 'US-012'],
  ['UC-27', 'Manage shop staff', 'Shop Owner', '-', 'US-013'],
  ['UC-28', 'View sales and COD payouts', 'Shop Owner', '-', 'US-054, 082'],
  ['UC-29', 'Approve or suspend shops', 'Platform Admin', 'Extended by Verify drug licence', 'US-011'],
  ['UC-30', 'Verify drug licence', 'Platform Admin', '«extend» Approve or suspend shops (medicine shops only)', 'US-016'],
  ['UC-31', 'Manage category tree', 'Platform Admin', '-', 'US-020'],
  ['UC-32', 'Manage attributes, options', 'Platform Admin', '-', 'US-021, 023'],
  ['UC-33', 'Review category requests', 'Platform Admin', '-', 'US-022'],
  ['UC-34', 'Manage users and roles', 'Platform Admin', '-', 'US-004'],
  ['UC-35', 'Moderate products, reviews', 'Platform Admin', '-', 'US-055'],
  ['UC-36', 'Publish policy pages', 'Platform Admin', '-', 'US-080, 081'],
  ['UC-37', 'Set delivery charges', 'Platform Admin', '-', 'US-051'],
  ['UC-38', 'Resolve complaints (72 h)', 'Platform Admin', '-', 'US-072'],
  ['UC-39', 'View shop storefront', 'Guest shopper', '-', 'US-014'],
  ['UC-40', 'Bulk upload products (CSV)', 'Shop Staff', '-', 'US-034'],
  ['UC-41', 'Upgrade to Verified seller', 'Shop Owner', '-', 'US-017'],
  ['UC-42', 'Share storefront link', 'Shop Owner', '-', 'US-014'],
  ['UC-43', 'List in "Other" category', 'Shop Staff', '«extend» Add product', 'US-024'],
  ['UC-44', 'Sort search results', 'Guest shopper', '«extend» Search products', 'US-043'],
  ['UC-45', 'Search in Bengali or Banglish', 'Guest shopper', '«extend» Search products', 'US-045'],
  ['UC-46', 'Compare offers from several shops (R2)', 'Guest shopper', '«extend» View product details', 'US-046'],
  ['UC-47', 'See delivery charge per shop', 'Guest shopper', '«include» from Manage cart', 'US-058'],
  ['UC-48', 'View shop performance score', 'Guest shopper', '«extend» View shop storefront', 'US-059'],
  ['UC-49', 'Delete try-on photos and results', 'Customer', '-', 'US-063'],
  ['UC-50', 'View marketplace metrics', 'Platform Admin', '-', 'US-083'],
];

const doc = new Document({
  title: 'Use Case Diagrams - Multi-Vendor E-Commerce Platform',
  styles: { default: { document: { run: { font: 'Calibri' } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT], size: 16, color: '808080' })] })] }) },
    children: [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Use Case Diagrams - Multi-Vendor E-Commerce Platform')] }),
      p('These UML use case diagrams show what each of the six actors can do in the system. Diagram 1 covers shopping and virtual try-on. Diagram 2 covers shop and platform management. A table of actors and a full use case list with story references follow the diagrams. Every user story maps to at least one use case. Small extensions (sorting, Bengali search, offer comparison, delivery charge per shop, shop score, the "Other" category) appear only in the table, to keep the diagrams readable.'),
      p('Notation: a solid line links an actor to a use case. A dashed arrow marked «include» is a step that always runs. A dashed arrow marked «extend» is optional behaviour. A hollow triangle means generalisation, so a Customer can do everything a Guest can, and a Shop Owner can do everything Shop Staff can.'),
      new Paragraph({ children: [new PageBreak()] }),
      img(d1, 1460, 1400, 610),
      caption('Diagram 1. Guest and Customer use cases, including the try-on flow and the external Try-on provider.'),
      new Paragraph({ children: [new PageBreak()] }),
      img(d2, 1460, 1420, 610),
      caption('Diagram 2. Shop Staff, Shop Owner and Platform Admin use cases.'),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Actors')] }),
      table([2400, 3600, CONTENT_W - 6000], actorsRows),
      new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [new TextRun('Use case list')] }),
      table([1000, 3200, 2400, CONTENT_W - 8400, 1800], ucRows),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, 'Use-Case-Diagrams.docx');
  fs.writeFileSync(out, buf);
  console.log('wrote', out, buf.length, 'bytes');
});
