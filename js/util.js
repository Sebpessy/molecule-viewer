// Small shared helpers.

export function esc(s){
  const d = document.createElement("div");
  d.textContent = (s == null) ? "" : String(s);
  return d.innerHTML;
}

export function slugify(n){
  return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function uid(){
  return (crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + "-" + Math.random().toString(16).slice(2);
}
