// Converts the exported product plan (plan.md) into a visual Word document.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  PageOrientation, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, Footer, PageNumber, LevelFormat, VerticalAlign,
} = require('docx');

// Diagrams are rendered into a temp folder so this folder stays clean.
const SCRATCH = path.join(require('os').tmpdir(), 'ecom-plan-build');
fs.mkdirSync(SCRATCH, { recursive: true });
const OUT = process.argv[2];
const SOURCE = process.argv[3] || 'plan-v2.4.md';

// ---------- SVG helpers ----------
const FONT = 'Helvetica, Arial, sans-serif';
const INK = '#1f2328', QUIET = '#57606a', EDGE = '#8c959f', ACC = '#2f6fb5', ACC_FILL = '#e8f0fb';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svgDoc = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" font-family="${FONT}"><defs>`
  + `<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${EDGE}"/></marker>`
  + `</defs>${body}</svg>`;
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 13}" font-weight="${o.bold ? 700 : 400}" text-anchor="${o.anchor || 'middle'}" fill="${o.fill || INK}"${o.italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
// Box centred at (cx, cy); first line bold, the rest quiet.
function box(cx, cy, w, h, lines, o = {}) {
  const fill = o.accent ? ACC_FILL : (o.fill || '#ffffff'), stroke = o.accent ? ACC : (o.stroke || EDGE);
  let s = `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${o.accent ? 2 : 1.3}"${o.dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
  const n = lines.length, top = cy - ((n - 1) * 16) / 2 + 4.5;
  lines.forEach((l, i) => { s += text(cx, top + i * 16, l, { bold: i === 0 && !o.plain, size: i === 0 ? 13 : 11.5, fill: i === 0 || o.plain ? INK : QUIET }); });
  return s;
}
const path_ = (d, o = {}) => `<path d="${d}" fill="none" stroke="${EDGE}" stroke-width="1.3"${o.dash ? ' stroke-dasharray="6 5"' : ''}${o.noArrow ? '' : ' marker-end="url(#arr)"'}/>`;

// A. Schema-driven catalog (same content as the doc's diagram).
function catalogSvg() {
  const xs = [84, 230, 376, 522, 668], y0 = 168, W = 120, H = 88;
  const items = [
    ['Seller form', 'fields built', 'from schema'], ['Server check', 'rejects foreign', 'attributes'],
    ['Product data', 'PostgreSQL,', 'typed values'], ['Search index', 'Meilisearch,', 'facet counts'],
    ['Filter panel', 'only this', 'category', 'attributes'],
  ];
  let b = `<rect x="24" y="48" width="712" height="56" rx="8" fill="${ACC_FILL}" stroke="${ACC}" stroke-width="2"/>`
    + text(380, 72, 'Category schema', { bold: true }) + text(380, 92, 'Each leaf category and its typed attributes, set by the Platform Admin', { size: 11.5 });
  b += path_('M84 104V166') + path_('M230 104V166') + path_('M668 104V166');
  [[144, 170], [290, 316], [436, 462], [582, 608]].forEach(([a, c]) => { b += path_(`M${a} 212H${c - 2}`); });
  b += text(92, 140, 'generates', { size: 11.5, anchor: 'start', fill: QUIET }) + text(238, 140, 'validates against', { size: 11.5, anchor: 'start', fill: QUIET })
    + text(660, 140, 'picks the facets', { size: 11.5, anchor: 'end', fill: QUIET });
  items.forEach((it, i) => { b += box(xs[i], y0 + H / 2, W, H, it); });
  return svgDoc('0 36 760 236', `<rect x="0" y="36" width="760" height="236" fill="#fff"/>` + b);
}

// B. System architecture (same content as the doc's diagram).
function archSvg() {
  let b = path_('M184 140H270') + path_('M472 110H504V76H534') + path_('M472 148H534') + path_('M472 176H504V220H534')
    + path_('M372 184V222') + path_('M372 272V298') + path_('M272 336H186') + path_('M472 336H636V250');
  b += text(228, 130, 'HTTPS', { size: 11.5, fill: QUIET }) + text(380, 208, 'enqueue jobs', { size: 11.5, anchor: 'start', fill: QUIET })
    + text(228, 326, 'calls', { size: 11.5, fill: QUIET }) + text(480, 326, 'writes index, counts, results', { size: 11.5, anchor: 'start', fill: QUIET });
  b += box(104, 140, 160, 72, ['Browser', 'customers, sellers,', 'admins'])
    + box(372, 140, 200, 88, ['Next.js app', 'pages, API, auth,', 'role and shop checks'], { accent: true })
    + box(636, 76, 200, 56, ['PostgreSQL', 'source of truth']) + box(636, 148, 200, 56, ['Meilisearch', 'search and facets'])
    + box(636, 220, 200, 56, ['Object storage + CDN', 'images, private try-on photos'])
    + box(372, 248, 200, 48, ['Job queue (Postgres)']) + box(372, 336, 200, 72, ['Worker', 'indexing, counts, timers,', 'SMS and email; try-on later'])
    + box(104, 336, 160, 72, ['Try-on API', 'external provider'], { dashed: true });
  return svgDoc('0 36 760 352', `<rect x="0" y="36" width="760" height="352" fill="#fff"/>` + b);
}

// C. Try-on decision flow.
function tryonSvg() {
  const X = 230, RX = 600;
  const diamond = (cy, l1, l2) => `<polygon points="${X - 110},${cy} ${X},${cy - 50} ${X + 110},${cy} ${X},${cy + 50}" fill="#fff" stroke="${EDGE}" stroke-width="1.3"/>`
    + text(X, cy - 3, l1) + text(X, cy + 14, l2);
  let b = '';
  // main spine
  b += path_(`M${X} 88V123`) + path_(`M${X} 225V248`) + path_(`M${X} 350V373`) + path_(`M${X} 475V510`)
    + path_(`M${X} 568V600`) + path_(`M${X} 658V698`) + path_(`M${X} 800V840`);
  // branches to the right
  [175, 300, 425, 750].forEach(y => { b += path_(`M${X + 110} ${y}H${RX - 162}`); });
  b += text(X + 12, 242, 'yes', { size: 11.5, anchor: 'start', fill: QUIET }) + text(X + 12, 367, 'no', { size: 11.5, anchor: 'start', fill: QUIET })
    + text(X + 12, 494, 'no', { size: 11.5, anchor: 'start', fill: QUIET }) + text(X + 12, 822, 'yes', { size: 11.5, anchor: 'start', fill: QUIET });
  b += text(X + 126, 168, 'no', { size: 11.5, anchor: 'start', fill: QUIET }) + text(X + 126, 293, 'yes', { size: 11.5, anchor: 'start', fill: QUIET })
    + text(X + 126, 418, 'yes', { size: 11.5, anchor: 'start', fill: QUIET }) + text(X + 126, 743, 'no', { size: 11.5, anchor: 'start', fill: QUIET });
  b += box(X, 60, 240, 56, ['Customer clicks Try on'], { accent: true })
    + diamond(175, 'Valid full-body', 'photo?') + diamond(300, 'Cached result', 'exists?') + diamond(425, 'Daily limit', 'reached?')
    + box(X, 539, 240, 56, ['Queue try-on job']) + box(X, 629, 240, 56, ['Worker calls try-on provider'])
    + diamond(750, 'Image', 'generated?') + box(X, 870, 240, 60, ['Store privately, show it', 'labelled as an AI preview'], { accent: true });
  b += box(RX, 175, 320, 56, ['Prompt: upload a full-length', 'photo (head to feet)'], { plain: true, fill: '#fdf3e7', stroke: '#d08a2e' })
    + box(RX, 300, 320, 56, ['Show the cached result instantly'], { plain: true })
    + box(RX, 425, 320, 56, ['Tell the user when they', 'can try again'], { plain: true, fill: '#fdf3e7', stroke: '#d08a2e' })
    + box(RX, 750, 320, 56, ['"Try on is unavailable right now"', '(not counted against the limit)'], { plain: true, fill: '#fdecea', stroke: '#c9473d' });
  return svgDoc('0 20 790 890', `<rect x="0" y="20" width="790" height="890" fill="#fff"/>` + b);
}

// C2. Guest checkout and account linking.
function guestSvg() {
  const X = 230, RX = 600, q = { size: 11.5, anchor: 'start', fill: QUIET };
  let b = path_(`M${X} 88V125`) + path_(`M${X} 183V220`) + path_(`M${X} 278V315`) + path_(`M${X} 373V410`)
    + path_(`M${X} 468V513`) + path_(`M${X} 615V666`) + path_(`M${X + 110} 565H${RX - 162}`) + path_(`M${X + 120} 700H${RX - 162}`);
  b += text(X + 12, 645, 'no', q) + text(X + 126, 558, 'yes', q);
  b += box(X, 60, 240, 56, ['Shopper adds products to cart', 'no login needed'], { accent: true })
    + box(X, 155, 240, 56, ['Checkout details', 'name, mobile, email, address'])
    + box(X, 250, 240, 56, ['Verify mobile by OTP', 'test mode: 123456'])
    + box(X, 345, 240, 56, ['Place cash-on-delivery order'])
    + box(X, 440, 240, 56, ['SMS and email confirmation', 'order number, tracking link'])
    + `<polygon points="${X - 120},565 ${X},515 ${X + 120},565 ${X},615" fill="#fff" stroke="${EDGE}" stroke-width="1.3"/>`
    + text(X, 561, 'Verified mobile or email', { size: 12 }) + text(X, 577, 'matches an account?', { size: 12 })
    + box(RX, 565, 320, 60, ['Order shows in that account', 'log in with password, or Forgot password'], { accent: true })
    + box(X, 700, 240, 64, ['Kept as a guest order', 'track with order number + OTP'])
    + box(RX, 700, 320, 64, ['Create an account with the same', 'mobile or email: guest orders attach'], { accent: true })
    + `<rect x="${RX - 160}" y="32" width="320" height="84" rx="8" fill="#f6f8fa" stroke="${EDGE}" stroke-dasharray="5 4"/>`
    + text(RX, 58, 'Shop Owner, Shop Staff, Admin', { bold: true }) + text(RX, 78, 'must always log in.', { size: 11.5, fill: QUIET })
    + text(RX, 96, 'No guest access to seller or admin areas.', { size: 11.5, fill: QUIET });
  return svgDoc('0 20 790 760', `<rect x="0" y="20" width="790" height="760" fill="#fff"/>` + b);
}

// D. Core data model (ERD).
function erdSvg() {
  const C = [20, 220, 420, 620, 820], R = [40, 220, 400], W = 160, H = 130;
  const ent = (c, r, name, fields, accent) => {
    const x = C[c], y = R[r];
    let s = `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" fill="#fff" stroke="${accent ? ACC : EDGE}" stroke-width="${accent ? 2 : 1.3}"/>`
      + `<rect x="${x + 1}" y="${y + 1}" width="${W - 2}" height="28" rx="5" fill="${accent ? ACC_FILL : '#f3f5f7'}"/>`
      + `<path d="M${x} ${y + 30}H${x + W}" stroke="${accent ? ACC : EDGE}" stroke-width="1"/>`
      + text(x + W / 2, y + 20, name, { bold: true, size: 12 });
    fields.forEach((f, i) => { s += text(x + 12, y + 50 + i * 18, f, { size: 11.5, anchor: 'start', fill: i === 0 ? INK : QUIET }); });
    return s;
  };
  const card = (x, y, s) => text(x, y, s, { size: 12, bold: true, fill: ACC, anchor: 'middle' });
  const line = d => `<path d="${d}" fill="none" stroke="${EDGE}" stroke-width="1.3"/>`;
  let b = '';
  b += line('M180 105H220') + card(188, 98, '1') + card(212, 98, '*');            // user - shop_member
  b += line('M380 105H420') + card(388, 98, '*') + card(412, 98, '1');            // shop_member - shop
  b += line('M100 170V220') + card(108, 184, '1') + card(108, 214, '*');          // user - order
  b += line('M180 285H220') + card(188, 278, '1') + card(212, 278, '*');          // order - shop_order
  b += line('M380 285H400V150H420') + card(388, 278, '*') + card(412, 143, '1');  // shop_order - shop
  b += line('M500 170V220') + card(508, 184, '1') + card(508, 214, '*');          // shop - product
  b += line('M500 350V400') + card(508, 364, '1') + card(508, 394, '*');          // product - variant
  b += line('M300 350V400') + card(308, 364, '1') + card(308, 394, '*');          // shop_order - order_item
  b += line('M380 465H420') + card(388, 458, '*') + card(412, 458, '1');          // order_item - variant
  b += line('M670 170V270H580') + card(678, 184, '1') + card(590, 263, '*');      // category - product
  b += line('M580 300H740V400') + card(590, 293, '1') + card(748, 394, '*');      // product - attr value
  b += line('M780 105H820') + card(788, 98, '1') + card(812, 98, '*');            // category - category_attribute
  b += line('M900 170V220') + card(908, 184, '*') + card(908, 214, '1');          // category_attribute - attribute
  b += line('M780 465H900V350') + card(788, 458, '*') + card(908, 364, '1');      // attr value - attribute
  b += ent(0, 0, 'User', ['id', 'email, name', 'is_platform_admin', 'status'])
    + ent(1, 0, 'ShopMember', ['shop_id + user_id', 'role (owner, staff)', 'permissions'])
    + ent(2, 0, 'Shop', ['id', 'name, slug, type', 'status', 'owner_id'])
    + ent(3, 0, 'Category', ['id', 'parent_id, path', 'is_leaf', 'live_product_count'], true)
    + ent(4, 0, 'CategoryAttribute', ['category_id', 'attribute_id', 'required, filterable', 'display_order'], true)
    + ent(0, 1, 'Order', ['id', 'user_id', 'status, total', 'payment_status'])
    + ent(1, 1, 'ShopOrder', ['id', 'order_id', 'shop_id', 'status, subtotal'])
    + ent(2, 1, 'Product', ['id', 'shop_id', 'category_id (leaf)', 'attributes JSONB', 'tryon_type'])
    + ent(4, 1, 'Attribute', ['id', 'key, name', 'type, unit', 'options'], true)
    + ent(1, 2, 'OrderItem', ['shop_order_id', 'variant_id', 'qty, unit_price'])
    + ent(2, 2, 'ProductVariant', ['id', 'product_id', 'sku, price, stock', 'variant_attrs'])
    + ent(3, 2, 'ProductAttributeValue', ['product_id', 'attribute_id', 'option_id or value'], true);
  b += `<rect x="20" y="560" width="14" height="14" rx="3" fill="${ACC_FILL}" stroke="${ACC}" stroke-width="1.5"/>`
    + text(42, 572, 'Catalog schema tables: these make the filters dynamic', { size: 12, anchor: 'start', fill: QUIET })
    + text(980, 572, '1 = one   * = many', { size: 12, anchor: 'end', fill: QUIET });
  return svgDoc('0 20 1000 570', `<rect x="0" y="20" width="1000" height="570" fill="#fff"/>` + b);
}

// E. Delivery timeline (Gantt).
function ganttSvg() {
  const WEEKS = 29, x = w => 250 + (w - 1) * 24, top = 90, rh = 34;
  const colors = { R1: '#2f6fb5', spike: '#d08a2e', R2: '#1a7f6e', R3: '#7b4bb7' };
  const rows = [
    ['Sprint 0 - setup, policy shells', 1, 1, 'R1'], ['Sprint 1 - accounts, OTP, address', 2, 3, 'R1'],
    ['Sprint 2 - shops, medicine licence', 4, 5, 'R1'], ['Sprint 3 - category schema', 6, 7, 'R1'],
    ['Sprint 4 - product form', 8, 9, 'R1'], ['Try-on spike', 8, 8, 'spike'],
    ['Sprint 5 - search, filters, wishlist', 10, 11, 'R1'], ['Sprint 6 - cart, COD checkout', 12, 13, 'R1'],
    ['Sprint 7 - returns, reviews, compliance', 14, 15, 'R1'],
    ['Sprint 8 - storefronts, CSV, scores', 16, 17, 'R1'],
    ['Sprints 9-11 - payments, courier', 18, 23, 'R2'], ['Sprints 12-14 - try-on', 24, 29, 'R3'],
  ];
  const bottom = top + rows.length * rh;
  let b = '';
  [['R1 - MVP (COD)', 'R1'], ['R2 - Payments, courier', 'R2'], ['R3 - Try-on', 'R3'], ['Spike', 'spike']].forEach(([l, k], i) => {
    const lx = 250 + i * 190;
    b += `<rect x="${lx}" y="22" width="14" height="14" rx="3" fill="${colors[k]}"/>` + text(lx + 22, 34, l, { size: 12.5, anchor: 'start' });
  });
  for (let w = 1; w <= WEEKS; w++) {
    b += `<line x1="${x(w)}" y1="${top - 8}" x2="${x(w)}" y2="${bottom}" stroke="#eaeef2"/>`;
    b += text(x(w) + 12, top - 14, String(w), { size: 11, fill: QUIET });
  }
  b += text(24, top - 14, 'Week', { size: 11, anchor: 'start', fill: QUIET });
  rows.forEach(([l, s, e, k], i) => {
    const y = top + i * rh + rh / 2;
    b += text(24, y + 4.5, l, { size: 12.5, anchor: 'start' });
    b += `<rect x="${x(s) + 2}" y="${y - 10}" width="${x(e) + 24 - x(s) - 4}" height="20" rx="5" fill="${colors[k]}" fill-opacity="0.85"/>`;
  });
  // The seller beta sits on its own lower line so its label never collides with the MVP gate's.
  [[9, 'Seller beta', 36, '#d08a2e'], [17, 'MVP test gate', 0, '#c9473d'], [29, 'Try-on gate', 0, '#c9473d']].forEach(([w, l, dy, c]) => {
    const gx = x(w) + 24, by = bottom + 12 + dy;
    b += `<line x1="${gx}" y1="${top - 4}" x2="${gx}" y2="${by}" stroke="${c}" stroke-width="1.5" stroke-dasharray="5 4"/>`
      + `<path d="M${gx} ${by}l9 9l-9 9l-9 -9z" fill="${c}"/>`
      + text(gx - 14, by + 14, `${l} (end of week ${w})`, { size: 12.5, bold: true, anchor: 'end', fill: c });
  });
  return svgDoc(`0 0 980 ${bottom + 84}`, `<rect width="980" height="${bottom + 84}" fill="#fff"/>` + b);
}

function render(name, svg, zoom) {
  fs.writeFileSync(path.join(SCRATCH, name + '.svg'), svg);
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: zoom }, font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' } }).render().asPng();
  fs.writeFileSync(path.join(SCRATCH, name + '.png'), png);
  const m = svg.match(/viewBox="([\d.\s-]+)"/)[1].trim().split(/\s+/).map(Number);
  return { svg: Buffer.from(svg), png, w: m[2], h: m[3] };
}
const D = {
  catalog: render('v-catalog', catalogSvg(), 3),
  arch: render('v-arch', archSvg(), 3),
  tryon: render('v-tryon', tryonSvg(), 3),
  guest: render('v-guest', guestSvg(), 3),
  erd: render('v-erd', erdSvg(), 2.5),
  gantt: render('v-gantt', ganttSvg(), 2.5),
};
const ucFile = n => render('v-' + n, fs.readFileSync(path.join(SCRATCH, n + '.svg'), 'utf8'), 2);
D.uc1 = ucFile('diagram1');
D.uc2 = ucFile('diagram2');

// ---------- Word helpers ----------
const A4_W = 11906, A4_H = 16838, MARGIN = 1080;
const PORTRAIT_W = A4_W - 2 * MARGIN, LANDSCAPE_W = A4_H - 2 * MARGIN;
const BODY = 20, NAVY = '1F3B5C';

let figNo = 0;
function figure(d, captionText, contentW, maxH) {
  figNo += 1;
  const maxW = (contentW / 1440) * 96;
  const s = Math.min(maxW / d.w, maxH / d.h);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160 }, keepNext: true, children: [new ImageRun({
      type: 'svg', data: d.svg, fallback: { type: 'png', data: d.png },
      transformation: { width: Math.round(d.w * s), height: Math.round(d.h * s) },
      altText: { title: captionText, description: captionText, name: `figure-${figNo}` },
    })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [
      new TextRun({ text: `Figure ${figNo}. `, bold: true, size: 18, color: '57606A' }),
      new TextRun({ text: captionText, italics: true, size: 18, color: '57606A' })] }),
  ];
}

const unescape = s => s.replace(/&#91;/g, '[').replace(/&#93;/g, ']').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\([\\`*_{}\[\]()#+\-.!|<>~"])/g, '$1');
// Inline markdown: **bold**, `code`, [text](url).
function runs(src, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m;
  const s = unescape(src);
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(new TextRun({ text: s.slice(last, m.index), size: BODY, ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), size: BODY, ...base, bold: true }));
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: BODY - 2, color: '8A2B5C', ...base }));
    else out.push(new TextRun({ text: t.match(/^\[([^\]]+)\]/)[1], size: BODY, color: '2F6FB5', underline: {}, ...base }));
    last = m.index + t.length;
  }
  if (last < s.length) out.push(new TextRun({ text: s.slice(last), size: BODY, ...base }));
  return out;
}

// Coloured cells make the matrices scannable.
function cellFill(header, value) {
  const h = header.toLowerCase(), v = value.toLowerCase();
  if (['likelihood', 'impact'].includes(h)) return { high: 'FCE8E6', medium: 'FEF7E0', low: 'E6F4EA' }[v];
  if (h === 'priority') return v.startsWith('must') ? 'E6F4EA' : v.startsWith('should') ? 'E8F0FE' : v.startsWith('could') ? 'F1F3F4' : undefined;
  if (['platform admin', 'shop owner', 'shop staff', 'customer'].includes(h)) {
    if (/^(yes|any|all)/.test(v)) return 'E6F4EA';
    if (/^no/.test(v)) return 'F6F8FA';
    if (/^own/.test(v)) return 'E8F0FE';
    return 'FEF7E0';
  }
  if (h === 'verdict' && /recommended|chosen/.test(v)) return 'E6F4EA';
  return undefined;
}

const bd = { style: BorderStyle.SINGLE, size: 4, color: 'C9D1D9' };
function mdTable(lines, contentW) {
  const rows = lines.filter((l, i) => i !== 1).map(l => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim()));
  const cols = rows[0].length;
  // Column widths in proportion to content length, with a floor.
  const len = Array.from({ length: cols }, (_, j) => Math.max(...rows.map(r => Math.min(unescape(r[j] || '').length, 70))));
  const weights = len.map(l => Math.max(l, 8));
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map(w => Math.floor((w / sum) * contentW));
  widths[cols - 1] += contentW - widths.reduce((a, b) => a + b, 0);
  const small = cols >= 5 || rows.length > 15;
  const sz = small ? 16 : 18;
  return new Table({
    width: { size: contentW, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, cantSplit: true, children: r.map((c, j) => {
      const fill = i === 0 ? NAVY : cellFill(rows[0][j] || '', unescape(c).replace(/\*\*/g, '')) || (i % 2 === 0 ? 'F8FAFC' : undefined);
      return new TableCell({
        borders: { top: bd, bottom: bd, left: bd, right: bd }, width: { size: widths[j], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
        margins: { top: 50, bottom: 50, left: 90, right: 90 },
        children: [new Paragraph({ children: runs(c, i === 0 ? { bold: true, color: 'FFFFFF', size: sz } : { size: sz }) })],
      });
    }) })),
  });
}

// ---------- Parse the markdown ----------
const md = fs.readFileSync(path.resolve(__dirname, SOURCE), 'utf8').split('\n');
const sections = [];   // { landscape, children }
let cur = { landscape: false, children: [] };
const push = (...els) => cur.children.push(...els);
const toc = [];
let h1 = 0, h2 = 0, olInstance = 0, inOl = false;

function heading(level, t) {
  if (level === 1) { h1 += 1; h2 = 0; toc.push(`${h1}. ${t}`); }
  else h2 += 1;
  const label = level === 1 ? `${h1}. ${t}` : `${h1}.${h2} ${t}`;
  push(new Paragraph({ heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, keepNext: true,
    pageBreakBefore: level === 1 && !cur.landscape, children: [new TextRun(label)] }));
}

// The use case diagrams get their own landscape section, before the catalog design.
function useCaseSection() {
  sections.push(cur);
  cur = { landscape: true, children: [] };
  heading(1, 'Use case diagrams');
  push(new Paragraph({ spacing: { after: 120 }, children: runs('Six actors use the system. A solid line links an actor to a use case, «include» marks a step that always runs, «extend» marks optional behaviour, and a hollow triangle means the lower actor can do everything the upper one can.') }));
  push(...figure(D.uc1, 'Shopping and virtual try-on (Guest, Customer, Try-on provider).', LANDSCAPE_W, 560));
  push(new Paragraph({ children: [new PageBreak()] }));
  push(...figure(D.uc2, 'Shop and platform management (Shop Staff, Shop Owner, Platform Admin).', LANDSCAPE_W, 560));
  sections.push(cur);
  cur = { landscape: false, children: [] };
}

for (let i = 0; i < md.length; i++) {
  const line = md[i];
  if (i < 4 && (line.startsWith('# ') || /^Oct \d/.test(line))) continue;   // title and byline go on the cover
  if (!line.trim()) { inOl = false; continue; }

  if (line.startsWith('## ')) {
    const t = line.slice(3).trim();
    if (t === 'Categories, attributes and dynamic filters') useCaseSection();
    heading(1, t);
    continue;
  }
  if (line.startsWith('### ')) {
    const t = line.slice(4).trim();
    heading(2, t);
    if (t === 'Guest checkout flow') push(...figure(D.guest, 'Guest checkout and account linking. Orders join an account only through a verified mobile or email.', PORTRAIT_W, 640));
    if (t === 'Try-on flow') push(...figure(D.tryon, 'Try-on decision flow: every exit gives the customer a clear message.', PORTRAIT_W, 700));
    if (t.startsWith('Data model')) push(...figure(D.erd, 'Core catalog and order model. Wishlist, cart, licence, returns, complaints, policy, payout, try-on and audit tables are in the table below.', PORTRAIT_W, 520));
    if (t === 'Sprint plan') push(...figure(D.gantt, 'Delivery timeline by week, with the two release gates.', PORTRAIT_W, 420));
    continue;
  }
  if (line.includes('embedded content: schema-driven catalog')) { push(...figure(D.catalog, 'One category schema drives the seller form, the stored data and the filters.', PORTRAIT_W, 400)); continue; }
  if (line.includes('embedded content: system architecture')) { push(...figure(D.arch, 'System architecture: slow work goes through the queue to the worker.', PORTRAIT_W, 420)); continue; }

  if (line.trim().startsWith('|')) {
    const block = [];
    while (i < md.length && md[i].trim().startsWith('|')) block.push(md[i++]);
    i -= 1;
    push(mdTable(block, PORTRAIT_W), new Paragraph({ spacing: { after: 80 }, children: [] }));
    continue;
  }
  let m;
  if ((m = line.match(/^(\s*)- \[( |x)\] (.*)$/))) {
    push(new Paragraph({ numbering: { reference: 'check', level: 0 }, spacing: { after: 60 }, children: runs(m[3]) }));
    continue;
  }
  if ((m = line.match(/^(\s*)- (.*)$/))) {
    push(new Paragraph({ numbering: { reference: 'bullets', level: Math.min(Math.floor(m[1].length / 4), 1) }, spacing: { after: 60 }, children: runs(m[2]) }));
    continue;
  }
  if ((m = line.match(/^(\s*)\d+\. (.*)$/))) {
    if (!inOl) { olInstance += 1; inOl = true; }
    push(new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: olInstance }, spacing: { after: 60 }, children: runs(m[2]) }));
    continue;
  }
  inOl = false;
  push(new Paragraph({ spacing: { after: 120, line: 276 }, children: runs(line) }));
}
sections.push(cur);

// ---------- Cover and contents ----------
const cover = [
  new Paragraph({ spacing: { before: 3200 }, children: [new TextRun({ text: 'PRODUCT PLAN', bold: true, size: 22, color: '2F6FB5', characterSpacing: 60 })] }),
  new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: 'Multi-Vendor E-Commerce Platform', bold: true, size: 56, color: NAVY })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '2F6FB5', space: 8 } }, spacing: { after: 240 },
    children: [new TextRun({ text: 'Discovery, requirements, design and delivery plan', size: 28, color: '57606A' })] }),
  new Paragraph({ children: [new TextRun({ text: 'Version 2.4  ·  16 October 2026  ·  Open marketplace for Bangladesh, testing-first  ·  Planning phase', size: 20, color: '57606A' })] }),
  new Paragraph({ spacing: { before: 1600 }, children: [new TextRun({ text: 'What is inside', bold: true, size: 22, color: NAVY })] }),
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Vision, decisions, go-to-market and revenue, Bangladesh compliance (policies, returns, cash on delivery, seller tiers, medicine shops), testing mode, guest checkout, roles, the schema-driven catalog with dynamic filters, virtual try-on, 55 user stories traced to use cases, use case diagrams, architecture, data model, security, and a 29-week roadmap.', size: 20, color: '57606A' })] }),
  new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Version 2 merges the comparison with Daraz and Rokomari, and the decisions taken after it.', italics: true, size: 18, color: '57606A' })] }),
];
const contents = [
  new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun('Contents')] }),
  ...toc.map(t => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t, size: 22 })] })),
  new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: `Figures: ${figNo} diagrams, numbered in order.`, italics: true, size: 18, color: '57606A' })] }),
];
sections[0].children.unshift(...cover, ...contents);

const footer = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
  new TextRun({ text: 'Multi-Vendor E-Commerce Platform · Product Plan    ', size: 16, color: '8C959F' }),
  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '8C959F' })] })] });

const doc = new Document({
  title: 'Multi-Vendor E-Commerce Platform - Product Plan',
  styles: {
    default: { document: { run: { font: 'Calibri', size: BODY } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, color: NAVY }, paragraph: { spacing: { before: 120, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2F6FB5', space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 25, bold: true, color: '2F6FB5' }, paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } }] },
    { reference: 'numbers', levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 320 } } } }] },
    { reference: 'check', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '☐', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 320 } } } }] },
  ] },
  sections: sections.map((s, idx) => ({
    properties: { page: {
      size: s.landscape ? { width: A4_W, height: A4_H, orientation: PageOrientation.LANDSCAPE } : { width: A4_W, height: A4_H },
      margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    }, titlePage: idx === 0 },
    footers: { default: footer(), first: new Footer({ children: [new Paragraph({ children: [] })] }) },
    children: s.children,
  })),
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(OUT, 'Product-Plan.docx');
  fs.writeFileSync(out, buf);
  console.log('wrote', out, buf.length, 'bytes;', figNo, 'figures;', toc.length, 'sections');
});
