// js/format.js — formats partages (pur)
export function ech(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function md(t) { return ech(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
function enLigne(s) { return md(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }
// Markdown minimal des reponses de Claude : paragraphes, titres, listes, gras, code en ligne (tout est echappe)
export function mdBloc(t) {
  const out = []; let para = [], liste = null;
  const fin = () => { if (para.length) { out.push("<p>" + para.map(enLigne).join("<br>") + "</p>"); para = []; } if (liste) { out.push("</" + liste + ">"); liste = null; } };
  for (const l of String(t || "").replace(/\r/g, "").split("\n")) {
    if (!l.trim()) { fin(); continue; }
    const titre = l.match(/^(#{1,4})\s+(.*)/), item = l.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)/);
    if (titre) { fin(); const n = titre[1].length <= 2 ? 3 : 4; out.push(`<h${n}>${enLigne(titre[2])}</h${n}>`); continue; }   // h2 reste le titre de section de la page
    if (item) { const type = item[1] ? "ol" : "ul"; if (liste !== type) { fin(); out.push("<" + type + ">"); liste = type; } out.push("<li>" + enLigne(item[2]) + "</li>"); continue; }
    if (liste) fin();
    para.push(l);
  }
  fin(); return out.join("");
}
export function ico(nom) { return `<svg class="ico" aria-hidden="true"><use href="#i-${nom}"/></svg>`; }
function fr(s) { return s.replace(".", ","); }
export function giga(x) {
  let s = x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x >= 0.01 ? x.toFixed(2) : x.toFixed(3);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return fr(s) + (parseFloat(s) >= 2 ? " gigas" : " giga");
}
export function volume(kwh) {
  if (kwh >= 1e9) return fr((kwh / 1e9).toFixed(1)) + " TWh";
  if (kwh >= 1e7) return (kwh / 1e6).toFixed(0) + " GWh";
  if (kwh >= 1e6) return fr((kwh / 1e6).toFixed(1)) + " GWh";
  return Math.max(Math.round(kwh / 1e3), 1) + " MWh";
}
export function dateFr(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  return iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
}
export function aujourdhui() { return new Date().toISOString().slice(0, 10); }
export function jours(iso, ref = aujourdhui()) {
  return Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(ref.slice(0, 10))) / 86400000);
}
export function pluriel(n, s, p) { return n + " " + (n > 1 ? p : s); }
function num(v) { const t = v >= 10 ? v.toFixed(0) : v.toFixed(1); return fr(t.includes(".") ? t.replace(/0+$/, "").replace(/\.$/, "") : t); }
function eur(v) { const r = v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 100) * 100; return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
export function fourchette(a, b) {
  let f, u;
  if (b >= 1e6) { f = (v) => num(v / 1e6); u = "M€"; } else if (b >= 1e4) { f = (v) => num(v / 1e3); u = "k€"; } else { f = eur; u = "€"; }
  return f(a) === f(b) ? `${f(a)} ${u}` : `${f(a)} – ${f(b)} ${u}`;
}
export function totalCout(cout) {
  if (!cout || !Array.isArray(cout.postes) || !cout.postes.length) return null;
  return { min: cout.postes.reduce((s, p) => s + (+p[1] || 0), 0), max: cout.postes.reduce((s, p) => s + (+p[2] || 0), 0) };
}
