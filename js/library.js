// The offline molecule library, lifted out of the HTML into data/molecules.json.
// Top-level await: the module graph waits for this fetch before any importer runs.

export const LIB = await fetch(new URL("../data/molecules.json", import.meta.url))
  .then(r => {
    if(!r.ok) throw new Error("molecules.json " + r.status);
    return r.json();
  })
  .catch(err => { console.error("Failed to load molecule library", err); return {}; });

export const LIB_KEYS = Object.keys(LIB);

// Case-insensitive lookup → canonical key, or null.
export function libKey(name){
  if(!name) return null;
  const t = String(name).toLowerCase();
  return LIB_KEYS.find(k => k.toLowerCase() === t) || null;
}
