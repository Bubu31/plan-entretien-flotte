const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'plan-entretien.json'), 'utf-8'));

const FC = {
  F1: '#3b82f6', F2: '#8b5cf6', F3: '#ef4444', F4: '#f59e0b',
  F5: '#06b6d4', F6: '#10b981', F7: '#84cc16', F8: '#6b7280'
};
const levelColors = { base: '#3b82f6', categorie: '#8b5cf6', carburant: '#84cc16', marque: '#f59e0b', modele: '#ef4444' };
const levelLabels = { base: 'Base', categorie: 'Categorie', carburant: 'Carburant', marque: 'Marque', modele: 'Modele' };

function getAction(code) {
  for (const d of Object.values(data.actions)) if (d.items[code]) return d.items[code];
  return { label: code, description: '' };
}

function resolveForfait(forfaitKey, vehicle) {
  const f = data.forfaits[forfaitKey];
  if (!f) return { levels: [], allActions: [], removed: [] };
  let parentLevels = [];
  if (f.includes) { parentLevels = resolveForfait(f.includes, vehicle).levels; }
  const levels = [], removed = new Set();
  if (f.base?.length) levels.push({ level: 'base', label: `${forfaitKey} — Base`, actions: [...f.base] });
  const catOv = f.par_categorie?.[vehicle.categorie];
  if (catOv?.add?.length) levels.push({ level: 'categorie', label: `Cat: ${vehicle.categorie}`, actions: catOv.add, note: catOv.note });
  (catOv?.remove || []).forEach(a => removed.add(a));
  const carbOv = f.par_carburant?.[vehicle.carburant];
  if (carbOv?.add?.length) levels.push({ level: 'carburant', label: `Carb: ${vehicle.carburant.toUpperCase()}`, actions: carbOv.add, note: carbOv.note });
  (carbOv?.remove || []).forEach(a => removed.add(a));
  const marqOv = f.par_marque?.[vehicle.marque];
  if (marqOv?.add?.length) levels.push({ level: 'marque', label: vehicle.marque, actions: marqOv.add, note: marqOv.note });
  const modOv = f.par_modele?.[vehicle.nom];
  if (modOv?.add?.length) levels.push({ level: 'modele', label: vehicle.nom, actions: modOv.add, note: modOv.note });
  const allLevels = [...parentLevels, ...levels];
  const allActions = [], seen = new Set();
  for (const l of allLevels) for (const a of l.actions) if (!seen.has(a) && !removed.has(a)) { allActions.push(a); seen.add(a); }
  return { levels: allLevels, allActions, removed: [...removed] };
}

function buildHTML() {
  let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  @page { size: A4; margin: 14mm 11mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #1e293b; line-height: 1.4; }
  h1 { font-size: 17pt; color: #0f172a; margin-bottom: 2pt; }
  h2 { font-size: 12pt; color: #1e3a5f; margin: 12pt 0 5pt; border-bottom: 2px solid #3b82f6; padding-bottom: 2pt; page-break-after: avoid; }
  h3 { font-size: 10pt; color: #334155; margin: 8pt 0 3pt; page-break-after: avoid; }
  .subtitle { font-size: 9pt; color: #64748b; margin-bottom: 10pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; font-size: 8pt; }
  th { background: #f1f5f9; font-weight: 600; text-align: left; padding: 3pt 4pt; border: .5pt solid #cbd5e1; font-size: 7pt; text-transform: uppercase; letter-spacing: .3pt; color: #475569; }
  td { padding: 3pt 4pt; border: .5pt solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .code { font-family: Consolas, monospace; font-weight: 600; font-size: 7.5pt; color: #3b82f6; }
  .tag { display: inline-block; font-size: 6.5pt; padding: 1pt 4pt; border-radius: 2pt; font-weight: 600; text-transform: uppercase; margin-right: 2pt; }
  .tag-autocar { background: #dbeafe; color: #1e40af; }
  .tag-interurbain { background: #ede9fe; color: #5b21b6; }
  .tag-urbain { background: #fee2e2; color: #991b1b; }
  .tag-sprinter_city { background: #fef3c7; color: #92400e; }
  .tag-minibus { background: #d1fae5; color: #065f46; }
  .tag-gnv { background: #ecfccb; color: #3f6212; }
  .tag-diesel { background: #f1f5f9; color: #475569; }
  .badge { display: inline-block; color: white; font-size: 7pt; font-weight: 700; padding: 1pt 4pt; border-radius: 2pt; margin-right: 1pt; }
  .note { background: #eff6ff; border-left: 2.5pt solid #3b82f6; padding: 3pt 6pt; margin: 3pt 0 6pt; font-size: 7.5pt; color: #475569; }
  .pagebreak { page-break-before: always; }
  .brand-hdr { background: #1e293b; color: white; padding: 3pt 6pt; font-size: 9pt; font-weight: 700; margin-top: 8pt; border-radius: 2pt; }
  .level { border-left: 2.5pt solid; padding: 2pt 0 2pt 8pt; margin: 2pt 0; }
  .level-label { font-size: 7pt; font-weight: 600; padding: 1pt 3pt; border-radius: 2pt; display: inline-block; margin-bottom: 1pt; }
  .footer { text-align: center; font-size: 6.5pt; color: #94a3b8; margin-top: 8pt; border-top: .5pt solid #e2e8f0; padding-top: 3pt; }
</style></head><body>`;

  // Cover
  html += `<h1>Plans d'entretien — Flotte Bus & Autocars</h1>
<div class="subtitle">${Object.keys(data.marques).length} marques, ${Object.values(data.marques).reduce((a,b) => a + b.modeles.length, 0)} modeles, ${Object.keys(data.forfaits).length} forfaits — Heritage : base → categorie → carburant → marque → modele</div>`;

  // ---- 1. FORFAITS with hierarchy ----
  html += '<h2>1. Forfaits mutualises — Structure d\'heritage</h2>';
  for (const [key, f] of Object.entries(data.forfaits)) {
    const color = FC[key];
    html += `<h3><span style="color:${color}">${key}</span> — ${f.label}</h3>`;
    html += `<p style="font-size:7.5pt;color:#64748b;margin-bottom:2pt;">${f.description}${f.includes ? ` (herite de ${f.includes})` : ''}</p>`;

    // Base
    html += `<div class="level" style="border-left-color:${levelColors.base}">`;
    html += `<span class="level-label" style="background:${levelColors.base}20;color:${levelColors.base}">BASE</span>`;
    html += ` <span style="font-size:7pt">${f.base.map(c => `<span class="code">${c}</span> ${getAction(c).label}`).join(' &bull; ')}</span></div>`;

    // Categorie
    if (f.par_categorie) {
      for (const [cat, ov] of Object.entries(f.par_categorie)) {
        if (!ov.add?.length) continue;
        html += `<div class="level" style="border-left-color:${levelColors.categorie}">`;
        html += `<span class="level-label" style="background:${levelColors.categorie}20;color:${levelColors.categorie}">CAT: ${cat.toUpperCase()}</span> `;
        html += `<span style="font-size:7pt">+ ${ov.add.map(c => `<span class="code">${c}</span> ${getAction(c).label}`).join(' &bull; ')}</span>`;
        if (ov.note) html += `<br><span style="font-size:6.5pt;color:#64748b;font-style:italic">${ov.note}</span>`;
        html += '</div>';
      }
    }

    // Carburant
    if (f.par_carburant) {
      for (const [carb, ov] of Object.entries(f.par_carburant)) {
        if (!ov.add?.length && !ov.remove?.length) continue;
        html += `<div class="level" style="border-left-color:${levelColors.carburant}">`;
        html += `<span class="level-label" style="background:${levelColors.carburant}20;color:${levelColors.carburant}">CARB: ${carb.toUpperCase()}</span> `;
        if (ov.add?.length) html += `<span style="font-size:7pt">+ ${ov.add.map(c => `<span class="code">${c}</span>`).join(' ')}</span> `;
        if (ov.remove?.length) html += `<span style="font-size:7pt;color:#ef4444">- ${ov.remove.map(c => `<span class="code" style="color:#ef4444">${c}</span>`).join(' ')}</span>`;
        if (ov.note) html += `<br><span style="font-size:6.5pt;color:#64748b;font-style:italic">${ov.note}</span>`;
        html += '</div>';
      }
    }

    // Marque
    if (f.par_marque) {
      for (const [m, ov] of Object.entries(f.par_marque)) {
        if (!ov.add?.length) continue;
        html += `<div class="level" style="border-left-color:${levelColors.marque}">`;
        html += `<span class="level-label" style="background:${levelColors.marque}20;color:${levelColors.marque}">${m.toUpperCase()}</span> `;
        html += `<span style="font-size:7pt">+ ${ov.add.map(c => `<span class="code">${c}</span> ${getAction(c).label}`).join(' &bull; ')}</span>`;
        if (ov.note) html += `<br><span style="font-size:6.5pt;color:#64748b;font-style:italic">${ov.note}</span>`;
        html += '</div>';
      }
    }

    // Modele
    if (f.par_modele) {
      for (const [m, ov] of Object.entries(f.par_modele)) {
        if (!ov.add?.length) continue;
        html += `<div class="level" style="border-left-color:${levelColors.modele}">`;
        html += `<span class="level-label" style="background:${levelColors.modele}20;color:${levelColors.modele}">${m}</span> `;
        html += `<span style="font-size:7pt">+ ${ov.add.map(c => `<span class="code">${c}</span> ${getAction(c).label}`).join(' &bull; ')}</span>`;
        if (ov.note) html += `<br><span style="font-size:6.5pt;color:#64748b;font-style:italic">${ov.note}</span>`;
        html += '</div>';
      }
    }
  }

  // ---- 2. ACTIONS CATALOG ----
  html += '<div class="pagebreak"></div><h2>2. Catalogue des actions</h2>';
  for (const [domKey, domain] of Object.entries(data.actions)) {
    html += `<h3>${domKey} — ${domain.label}</h3>`;
    html += '<table><thead><tr><th style="width:30pt">Code</th><th>Action</th><th>Description</th></tr></thead><tbody>';
    for (const [code, a] of Object.entries(domain.items)) {
      html += `<tr><td class="code">${code}</td><td><strong>${a.label}</strong></td><td style="color:#64748b">${a.description}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  // ---- 3. RESOLVED PER MODEL ----
  html += '<div class="pagebreak"></div><h2>3. Actions resolues par vehicule (F1 — Entretien courant)</h2>';
  html += '<p style="font-size:7.5pt;color:#64748b;margin-bottom:6pt;">Pour chaque modele : actions F1 resolues = base + categorie + carburant + marque + modele</p>';

  for (const [marque, info] of Object.entries(data.marques)) {
    html += `<div class="brand-hdr">${marque}</div>`;
    html += '<table><thead><tr><th>Modele</th><th>Cat.</th><th>Actions F1 resolues</th><th>Total</th></tr></thead><tbody>';
    for (const m of info.modeles) {
      const vehicle = { ...m, marque };
      const resolved = resolveForfait('F1', vehicle);
      html += `<tr><td><strong>${m.nom}</strong></td>`;
      html += `<td><span class="tag tag-${m.categorie}">${m.categorie}</span><span class="tag tag-${m.carburant}">${m.carburant}</span></td>`;
      html += '<td style="font-size:7pt">';
      for (const level of resolved.levels) {
        const lc = levelColors[level.level];
        if (level.actions.length) {
          html += level.actions.map(c => `<span class="code" style="color:${lc}" title="${level.label}">${c}</span>`).join(' ');
          html += ' ';
        }
      }
      if (resolved.removed.length) {
        html += resolved.removed.map(c => `<span class="code" style="color:#ef4444;text-decoration:line-through">${c}</span>`).join(' ');
      }
      html += `</td><td style="text-align:center;font-weight:700;color:${FC.F1}">${resolved.allActions.length}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  // ---- 4. MATRIX ----
  html += '<div class="pagebreak"></div><h2>4. Matrice periodicites</h2>';
  const fks = Object.keys(data.forfaits);
  html += '<table><thead><tr><th>Marque</th><th>Modele</th>';
  for (const fk of fks) html += `<th style="text-align:center;color:${FC[fk]}">${fk}</th>`;
  html += '</tr></thead><tbody>';
  for (const [marque, info] of Object.entries(data.marques)) {
    html += `<tr><td colspan="${2+fks.length}" style="background:#1e293b;color:white;font-weight:700">${marque}</td></tr>`;
    for (const m of info.modeles) {
      html += `<tr><td style="color:#64748b;font-size:7pt">${marque}</td><td><strong>${m.nom}</strong></td>`;
      for (const fk of fks) {
        const v = m.periodicite[fk];
        html += `<td style="text-align:center;font-size:7pt">${v || '<span style="color:#cbd5e1">—</span>'}</td>`;
      }
      html += '</tr>';
    }
  }
  html += '</tbody></table>';

  // ---- 5. CYCLES ----
  html += '<div class="pagebreak"></div><h2>5. Cycles d\'entretien type</h2>';
  const cycles = [
    { title: 'Autocar diesel — 120 000 km', steps: [
      { km: '0', f: ['F1'] }, { km: '30 000', f: ['F1'] }, { km: '60 000', f: ['F2'] },
      { km: '90 000', f: ['F1'] }, { km: '120 000', f: ['F3', 'F4'] }
    ], notes: 'Annuel : F5 (clim 1x/an), F6 (securite 1x/an). Pneus : F8 a l\'usure.' },
    { title: 'Interurbain diesel — 100 000 km', steps: [
      { km: '0', f: ['F1'] }, { km: '25 000', f: ['F1'] }, { km: '50 000', f: ['F2'] },
      { km: '75 000', f: ['F1'] }, { km: '100 000', f: ['F3', 'F4'] }
    ], notes: 'Annuel : F5 + F6. Pneus : F8 a l\'usure.' },
    { title: 'Urbain diesel — 80 000 km', steps: [
      { km: '0', f: ['F1'] }, { km: '20 000', f: ['F1'] }, { km: '40 000', f: ['F2'] },
      { km: '60 000', f: ['F1'] }, { km: '80 000', f: ['F3', 'F4'] }
    ], notes: 'Semestriel : F5 (clim 2x/an), F6 (securite 2x/an). Pneus : mensuel.' },
    { title: 'Urbain GNV — 80 000 km', steps: [
      { km: '0', f: ['F1'] }, { km: '20 000', f: ['F1'] }, { km: '40 000', f: ['F2', 'F7'] },
      { km: '60 000', f: ['F1'] }, { km: '80 000', f: ['F3', 'F4', 'F7'] }
    ], notes: 'Semestriel : F5 + F6. Pneus : mensuel. Requalification reservoirs GNV tous les 4-5 ans.' }
  ];
  for (const c of cycles) {
    html += `<h3>${c.title}</h3>`;
    html += '<table><thead><tr><th style="width:55pt">Km</th><th>Forfaits</th></tr></thead><tbody>';
    for (const s of c.steps) {
      html += `<tr><td class="code" style="text-align:right">${s.km} km</td>`;
      html += `<td>${s.f.map(fk => `<span class="badge" style="background:${FC[fk]}">${fk} ${data.forfaits[fk].label}</span>`).join(' ')}</td></tr>`;
    }
    html += '</tbody></table>';
    html += `<div class="note">${c.notes}</div>`;
  }

  // Legend
  html += '<h3>Legende des niveaux d\'heritage</h3>';
  html += '<table><thead><tr><th>Niveau</th><th>Couleur</th><th>Description</th></tr></thead><tbody>';
  for (const [k, label] of Object.entries(levelLabels)) {
    html += `<tr><td><span class="level-label" style="background:${levelColors[k]}20;color:${levelColors[k]}">${label}</span></td>`;
    html += `<td style="color:${levelColors[k]};font-weight:600">${levelColors[k]}</td>`;
    html += `<td>${{
      base: 'Actions communes a tous les vehicules pour ce forfait',
      categorie: 'Ajouts specifiques au type (autocar, urbain, interurbain...)',
      carburant: 'Ajouts/retraits lies au carburant (GNV remplace filtres diesel)',
      marque: 'Ajouts specifiques au constructeur (outils diag, post-traitement...)',
      modele: 'Ajouts specifiques a un modele precis (retarder, articulation...)'
    }[k]}</td></tr>`;
  }
  html += '</tbody></table>';

  html += `<div class="footer">Plan d'entretien flotte — Heritage base → categorie → carburant → marque → modele — ${new Date().toLocaleDateString('fr-FR')}</div>`;
  html += '</body></html>';
  return html;
}

(async () => {
  const htmlContent = buildHTML();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const outputPath = path.join(__dirname, 'plan-entretien.pdf');
  await page.pdf({
    path: outputPath, format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '11mm', right: '11mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:7pt;color:#94a3b8;text-align:center;width:100%;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  });
  await browser.close();
  console.log('PDF genere :', outputPath);
})();
