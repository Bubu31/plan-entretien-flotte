const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'plan-entretien.json'), 'utf-8'));

const forfaitColors = {
  F1: '#3b82f6', F2: '#8b5cf6', F3: '#ef4444', F4: '#f59e0b',
  F5: '#06b6d4', F6: '#10b981', F7: '#84cc16', F8: '#6b7280'
};

function getActionLabel(code) {
  for (const domain of Object.values(data.actions)) {
    if (domain.items[code]) return domain.items[code].label;
  }
  return code;
}

function getAllForfaitActions(key) {
  const f = data.forfaits[key];
  let actions = [...f.actions];
  if (f.includes) actions = [...getAllForfaitActions(f.includes), ...actions];
  return actions;
}

function buildHTML() {
  let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  @page { size: A4; margin: 15mm 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1e293b; line-height: 1.45; }
  h1 { font-size: 18pt; color: #0f172a; margin-bottom: 2pt; }
  h2 { font-size: 13pt; color: #1e3a5f; margin: 14pt 0 6pt; border-bottom: 2px solid #3b82f6; padding-bottom: 3pt; page-break-after: avoid; }
  h3 { font-size: 10.5pt; color: #334155; margin: 10pt 0 4pt; page-break-after: avoid; }
  .subtitle { font-size: 9.5pt; color: #64748b; margin-bottom: 12pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; font-size: 8.5pt; }
  th { background: #f1f5f9; font-weight: 600; text-align: left; padding: 4pt 5pt; border: .5pt solid #cbd5e1; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .3pt; color: #475569; }
  td { padding: 3.5pt 5pt; border: .5pt solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .code { font-family: 'Consolas', 'Courier New', monospace; font-weight: 600; font-size: 8pt; }
  .accent { color: #3b82f6; }
  .tag { display: inline-block; font-size: 7pt; padding: 1pt 5pt; border-radius: 3pt; font-weight: 600; text-transform: uppercase; letter-spacing: .3pt; margin-right: 2pt; }
  .tag-autocar { background: #dbeafe; color: #1e40af; }
  .tag-interurbain { background: #ede9fe; color: #5b21b6; }
  .tag-urbain { background: #fee2e2; color: #991b1b; }
  .tag-sprinter_city { background: #fef3c7; color: #92400e; }
  .tag-minibus { background: #d1fae5; color: #065f46; }
  .tag-diesel { background: #f1f5f9; color: #475569; }
  .tag-gnv { background: #ecfccb; color: #3f6212; }
  .forfait-badge { display: inline-block; color: white; font-size: 7.5pt; font-weight: 700; padding: 1pt 5pt; border-radius: 3pt; margin-right: 2pt; }
  .note { background: #eff6ff; border-left: 3pt solid #3b82f6; padding: 4pt 8pt; margin: 4pt 0 8pt; font-size: 8pt; color: #475569; }
  .pagebreak { page-break-before: always; }
  .brand-header { background: #1e293b; color: white; padding: 4pt 8pt; font-size: 10pt; font-weight: 700; margin-top: 10pt; border-radius: 3pt; }
  .cycle-step { display: flex; align-items: center; gap: 6pt; margin-bottom: 3pt; }
  .cycle-km { font-family: Consolas, monospace; font-size: 8pt; color: #64748b; min-width: 60pt; text-align: right; }
  .cycle-bar { height: 18pt; border-radius: 3pt; display: flex; align-items: center; padding: 0 6pt; font-size: 7.5pt; font-weight: 600; color: white; }
  .toc { margin: 10pt 0 16pt; }
  .toc-item { font-size: 9pt; padding: 2pt 0; }
  .toc-item a { color: #3b82f6; text-decoration: none; }
  .footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 10pt; border-top: .5pt solid #e2e8f0; padding-top: 4pt; }
</style></head><body>`;

  // Cover
  html += `<h1>Plans d'entretien</h1>
<div class="subtitle">Flotte Bus & Autocars — ${Object.keys(data.marques).length} marques, ${Object.values(data.marques).reduce((a,b) => a + b.modeles.length, 0)} modeles, ${Object.keys(data.forfaits).length} forfaits mutualises</div>`;

  // TOC
  html += `<div class="toc">
<div class="toc-item"><strong>1.</strong> Forfaits mutualises</div>
<div class="toc-item"><strong>2.</strong> Catalogue des actions</div>
<div class="toc-item"><strong>3.</strong> Vehicules par marque — Periodicites</div>
<div class="toc-item"><strong>4.</strong> Matrice recapitulative</div>
<div class="toc-item"><strong>5.</strong> Cycles d'entretien type</div>
</div>`;

  // ---- 1. FORFAITS ----
  html += `<h2>1. Forfaits mutualises</h2>`;
  for (const [key, f] of Object.entries(data.forfaits)) {
    const color = forfaitColors[key];
    const allActions = getAllForfaitActions(key);
    const ownActions = f.actions;
    html += `<h3><span style="color:${color}">${key}</span> — ${f.label}</h3>`;
    html += `<p style="font-size:8pt;color:#64748b;margin-bottom:3pt;">${f.description}${f.includes ? ` (inclut ${f.includes})` : ''}</p>`;
    if (f.note) html += `<div class="note">${f.note}</div>`;
    html += `<table><thead><tr><th style="width:40pt">Code</th><th>Action</th><th style="width:35pt">Via</th></tr></thead><tbody>`;
    for (const code of allActions) {
      const inherited = !ownActions.includes(code);
      html += `<tr><td class="code accent">${code}</td><td>${getActionLabel(code)}</td><td style="font-size:7pt;color:#8b5cf6">${inherited ? f.includes : ''}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  // ---- 2. CATALOGUE ACTIONS ----
  html += `<div class="pagebreak"></div><h2>2. Catalogue des actions</h2>`;
  for (const [domKey, domain] of Object.entries(data.actions)) {
    html += `<h3>${domKey} — ${domain.label}</h3>`;
    html += `<table><thead><tr><th style="width:35pt">Code</th><th>Action</th><th>Description</th><th style="width:50pt">Forfaits</th></tr></thead><tbody>`;
    for (const [code, a] of Object.entries(domain.items)) {
      const usedIn = Object.entries(data.forfaits).filter(([,f]) => f.actions.includes(code)).map(([k]) => k);
      html += `<tr><td class="code accent">${code}</td><td><strong>${a.label}</strong></td><td style="color:#64748b">${a.description}</td>`;
      html += `<td>${usedIn.map(f => `<span class="forfait-badge" style="background:${forfaitColors[f]}">${f}</span>`).join('')}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  // ---- 3. VEHICULES PAR MARQUE ----
  html += `<div class="pagebreak"></div><h2>3. Vehicules par marque</h2>`;
  const forfaitKeys = Object.keys(data.forfaits);
  for (const [marque, info] of Object.entries(data.marques)) {
    html += `<div class="brand-header">${marque} — ${info.modeles.length} modele${info.modeles.length > 1 ? 's' : ''}</div>`;
    html += `<table><thead><tr><th>Modele</th><th>Cat.</th><th>Carb.</th>`;
    for (const fk of forfaitKeys) html += `<th style="text-align:center;color:${forfaitColors[fk]}">${fk}</th>`;
    html += `<th>Particularite</th></tr></thead><tbody>`;

    for (const m of info.modeles) {
      html += `<tr><td><strong>${m.nom}</strong></td>`;
      html += `<td><span class="tag tag-${m.categorie}">${data.categories[m.categorie]?.label || m.categorie}</span></td>`;
      html += `<td><span class="tag tag-${m.carburant}">${m.carburant.toUpperCase()}</span></td>`;
      for (const fk of forfaitKeys) {
        const v = m.periodicite[fk];
        html += `<td style="text-align:center;font-size:7.5pt">${v || '<span style="color:#cbd5e1">—</span>'}</td>`;
      }
      html += `<td style="font-size:7.5pt;color:#64748b">${m.particularite || ''}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  // ---- 4. MATRICE ----
  html += `<div class="pagebreak"></div><h2>4. Matrice recapitulative</h2>`;
  html += `<table><thead><tr><th>Marque</th><th>Modele</th>`;
  for (const fk of forfaitKeys) html += `<th style="text-align:center;color:${forfaitColors[fk]}">${fk}</th>`;
  html += `</tr></thead><tbody>`;
  for (const [marque, info] of Object.entries(data.marques)) {
    html += `<tr><td colspan="${2 + forfaitKeys.length}" style="background:#1e293b;color:white;font-weight:700;font-size:8.5pt">${marque}</td></tr>`;
    for (const m of info.modeles) {
      html += `<tr><td style="color:#64748b;font-size:7.5pt">${marque}</td><td><strong>${m.nom}</strong></td>`;
      for (const fk of forfaitKeys) {
        const v = m.periodicite[fk];
        html += `<td style="text-align:center;font-size:7.5pt">${v || '<span style="color:#cbd5e1">—</span>'}</td>`;
      }
      html += `</tr>`;
    }
  }
  html += `</tbody></table>`;

  // ---- 5. CYCLES ----
  html += `<div class="pagebreak"></div><h2>5. Cycles d'entretien type</h2>`;

  const cycles = [
    { title: 'Autocar diesel — Cycle 120 000 km', steps: [
      { km: '0', f: ['F1'] }, { km: '30 000', f: ['F1'] }, { km: '60 000', f: ['F2'] },
      { km: '90 000', f: ['F1'] }, { km: '120 000', f: ['F3', 'F4'] }
    ], notes: 'Annuel : F5 (clim 1x/an), F6 (securite 1x/an). Pneus : F8 a l\'usure.' },
    { title: 'Interurbain diesel — Cycle 100 000 km', steps: [
      { km: '0', f: ['F1'] }, { km: '25 000', f: ['F1'] }, { km: '50 000', f: ['F2'] },
      { km: '75 000', f: ['F1'] }, { km: '100 000', f: ['F3', 'F4'] }
    ], notes: 'Annuel : F5 (clim 1x/an), F6 (securite 1x/an). Pneus : F8 a l\'usure.' },
    { title: 'Urbain diesel — Cycle 80 000 km', steps: [
      { km: '0', f: ['F1'] }, { km: '20 000', f: ['F1'] }, { km: '40 000', f: ['F2'] },
      { km: '60 000', f: ['F1'] }, { km: '80 000', f: ['F3', 'F4'] }
    ], notes: 'Semestriel : F5 (clim 2x/an), F6 (securite 2x/an). Pneus : controle mensuel.' },
    { title: 'Urbain GNV — Cycle 80 000 km', steps: [
      { km: '0', f: ['F1'] }, { km: '20 000', f: ['F1'] }, { km: '40 000', f: ['F2', 'F7'] },
      { km: '60 000', f: ['F1'] }, { km: '80 000', f: ['F3', 'F4', 'F7'] }
    ], notes: 'Semestriel : F5 + F6. Pneus : mensuel. Requalification reservoirs GNV tous les 4-5 ans.' }
  ];

  for (const c of cycles) {
    html += `<h3>${c.title}</h3>`;
    html += `<table><thead><tr><th style="width:60pt">Km</th><th>Forfaits</th></tr></thead><tbody>`;
    for (const step of c.steps) {
      html += `<tr><td class="code" style="text-align:right">${step.km} km</td>`;
      html += `<td>${step.f.map(fk => `<span class="forfait-badge" style="background:${forfaitColors[fk]}">${fk} ${data.forfaits[fk].label}</span>`).join(' ')}</td></tr>`;
    }
    html += `</tbody></table>`;
    html += `<div class="note">${c.notes}</div>`;
  }

  html += `<div class="footer">Plan d'entretien flotte — Document genere automatiquement — ${new Date().toLocaleDateString('fr-FR')}</div>`;
  html += `</body></html>`;
  return html;
}

(async () => {
  const htmlContent = buildHTML();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const outputPath = path.join(__dirname, 'plan-entretien.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:7pt;color:#94a3b8;text-align:center;width:100%;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  });
  await browser.close();
  console.log('PDF genere :', outputPath);
})();
