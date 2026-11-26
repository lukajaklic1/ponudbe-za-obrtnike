import type { ConfigData, ConfigItem } from '../pages/ConfiguratorPage'

/**
 * A window line that came in through the customer's configurator (an enquiry) is stored with the frozen choices
 * (names), not as a window position of the quote editor. This turns it into a real window position: the choices are
 * matched back to the price list, so "Uredi okno" opens the configurator with exactly this window.
 * Returns null when it is not such a line, or when a choice can no longer be found in the price list
 * (then the line stays as it is, so nothing is changed silently).
 */
export function windowFromConfigurator(l: { config: Record<string, unknown> | null; name: string; room: string; quantity: number | null }, cfg: ConfigData, sl: boolean, newKey: () => string, newUid: () => string): Record<string, unknown> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = l.config as Record<string, any> | null
  if (!c || c.kind || !(c.type_id || c.roof) || !(c.system_id || c.roof)) return null
  const b = cfg.builder
  let missing = false
  const idOf = (list: { id: string; name: string }[] | null | undefined, name?: string | null): string | null => {
    if (!name) return null
    const f = (list ?? []).find(x => x.name === name)
    if (!f) { missing = true; return null }
    return f.id
  }
  const material = c.material as string | undefined
  const colorList = (material && b?.colors?.[material]) || []
  const colors = c.colors ? { out: idOf(colorList, c.colors.out), in: idOf(colorList, c.colors.in) } : null
  const shades = (b?.shading ?? []).filter(x => x.kind === 'shade'), screens = (b?.shading ?? []).filter(x => x.kind === 'screen')
  const item: ConfigItem = {
    key: newKey(), type_id: c.type_id ?? '', system_id: c.system_id ?? '', width: c.width ?? null, height: c.height ?? null,
    hinge: c.hinge ?? 'left', quantity: Number(l.quantity ?? 1), label: l.room ?? '', option_ids: Array.isArray(c.option_ids) ? c.option_ids : [],
    spec: c.spec ?? null, colors,
    glass: c.glass?.name ? idOf(b?.glass, c.glass.name) : null,
    handle: c.handle?.name ? idOf(b?.handles, c.handle.name) : null,
    sills: c.sills ? { in: idOf(b?.sills, c.sills.in), out: idOf(b?.sills, c.sills.out) } : null,
    shading: c.shading ? { shade: idOf(shades, c.shading.shade), screen: idOf(screens, c.shading.screen), color: c.shading.color ?? null } : null,
    roof: c.roof ?? null,
  }
  if (missing) return null
  const rows: [string, string][] = []
  const add = (k: string, v: unknown) => { if (v) rows.push([k, String(v)]) }
  add(sl ? 'Profilni sistem' : 'Profile', c.system_name)
  if (c.width && c.height) add(sl ? 'Mere' : 'Size', `${c.width} × ${c.height} mm`)
  if (c.colors?.out || c.colors?.in) add(sl ? 'Barva' : 'Colour', `${sl ? 'Zunaj' : 'Outside'}: ${c.colors.out ?? '—'} · ${sl ? 'Znotraj' : 'Inside'}: ${c.colors.in ?? '—'}`)
  if (c.glass?.name) add(sl ? 'Steklo' : 'Glass', c.glass.ug != null ? `${c.glass.name}, Ug ${Number(c.glass.ug).toFixed(1).replace('.', ',')} W/m²K` : c.glass.name)
  add(sl ? 'Kljuka' : 'Handle', c.handle?.name)
  add(sl ? 'Notranja polica' : 'Inside sill', c.sills?.in)
  add(sl ? 'Zunanja polica' : 'Outside sill', c.sills?.out)
  add(sl ? 'Senčilo' : 'Shading', c.shading?.shade)
  add(sl ? 'Komarnik' : 'Insect screen', c.shading?.screen)
  add(sl ? 'Oznaka' : 'Label', l.room)
  return { kind: 'window', uid: newUid(), item, title: l.name, rows, template: c.template ?? null }
}
