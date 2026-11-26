import type { ConfigData, ConfigItem } from '../pages/ConfiguratorPage'
import { SHADE_PRESETS, shadeColorsOf } from './shadeColors'
import { isService, type WindowOption } from './windows'

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()

/**
 * A window line that came in through the customer's configurator (an enquiry) is stored with the frozen choices
 * (names), not as a window position of the quote editor. This turns it into a real window position: the choices are
 * matched back to the price list, so "Uredi okno" opens the configurator with exactly this window.
 * Returns null when it is not such a line. A choice that is no longer in the price list (renamed glass, colour
 * dropped) does not stop the window from becoming a position: the frozen names still describe it, and only the
 * editor falls back to the standard choice there.
 */
export function windowFromConfigurator(l: { config: Record<string, unknown> | null; name: string; room: string; quantity: number | null }, cfg: ConfigData, sl: boolean, newKey: () => string, newUid: () => string): Record<string, unknown> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = l.config as Record<string, any> | null
  // a line the configurator wrote: the frozen choices, with no `kind` of its own.
  // a window is either built from sashes (spec), picked from the price list (type_id) or a roof window (roof)
  if (!c || c.kind) return null
  if (!(c.spec || c.type_id || c.roof)) return null
  if (!c.roof && !c.system_id) return null
  const b = cfg.builder
  const idOf = (list: { id: string; name: string }[] | null | undefined, name?: string | null): string | null => {
    const n = norm(name)
    if (!n) return null
    return (list ?? []).find(x => norm(x.name) === n)?.id ?? null
  }
  // the colour of the shading is frozen as a name too ("enaka kot okvir" = same as the frame = no choice)
  const shadeColorId = (name?: string | null): string | null => {
    const n = norm(name)
    if (!n || n === 'enaka kot okvir' || n === 'same as the frame') return null
    const hit = (xs: { id: string; name: string; name_en?: string }[]) => xs.find(x => norm(x.name) === n || norm(x.name_en) === n)?.id
    return hit(shadeColorsOf(b?.shade_colors)) ?? hit(SHADE_PRESETS) ?? null
  }
  const material = c.material as string | undefined
  const colorList = (material && b?.colors?.[material]) || []
  const colors = c.colors ? { out: idOf(colorList, c.colors.out), in: idOf(colorList, c.colors.in) } : null
  const shades = (b?.shading ?? []).filter(x => x.kind === 'shade'), screens = (b?.shading ?? []).filter(x => x.kind === 'screen')
  const spec = (c.spec ?? null) as ConfigItem['spec']
  // sashes set by hand keep their widths (the spec carries them as weights)
  const weights = spec && !/sliding|wall/.test(String(spec.kind ?? '')) ? (spec.main ?? []).map(f => (f as { weight?: number }).weight) : []
  const sashWidths = weights.length && weights.every(w => typeof w === 'number' && w > 0) ? weights as number[] : null
  const item: ConfigItem = {
    key: newKey(), type_id: c.type_id ?? '', system_id: c.system_id ?? '', width: c.width ?? null, height: c.height ?? null,
    hinge: c.hinge ?? 'left', quantity: Number(l.quantity ?? 1), label: l.room ?? '', option_ids: Array.isArray(c.option_ids) ? c.option_ids : [],
    spec, colors, sashWidths,
    glass: c.glass?.name ? idOf(b?.glass, c.glass.name) : null,
    handle: c.handle?.name ? idOf(b?.handles, c.handle.name) : null,
    sills: c.sills ? { in: idOf(b?.sills, c.sills.in), out: idOf(b?.sills, c.sills.out) } : null,
    shading: c.shading ? { shade: idOf(shades, c.shading.shade), screen: idOf(screens, c.shading.screen), color: shadeColorId(c.shading.color) } : null,
    roof: c.roof ?? null,
  }
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

/** a service of an enquiry is written as a plain line; this matches it back to the price list, so the quote
 *  shows it as a chosen service again (ticked, and recounted when the windows change) */
export function serviceFromConfigurator(l: { config: Record<string, unknown> | null; name: string }, options: WindowOption[]): WindowOption | null {
  if (l.config) return null
  const n = norm(l.name)
  if (!n) return null
  return options.find(o => isService(o) && norm(o.name) === n) ?? null
}

/** work that comes with the installation on its own (sills, shading, insect screens): never ticked by hand */
export const isAutoService = (o: WindowOption) => !!o.per_item && o.per_item !== 'window' && o.per_item !== 'roof'
