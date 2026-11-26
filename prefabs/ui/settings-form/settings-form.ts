/**
 * Settings form from a schema: sliders, switches and choice buttons bound to the
 * game's settings store. Changes apply at once; the game decides how they are saved.
 *
 * Built by the component: <div class="cp-settings"> rows <label class="cp-setting">…</label>, a status line and an optional reset button.
 */
import { make, press } from '../dom.ts';

export type SettingField =
  | { key: string; label: string; note?: string; type: 'range'; min: number; max: number; step: number; format?: (value: number) => string }
  | { key: string; label: string; note?: string; type: 'toggle' }
  | { key: string; label: string; note?: string; type: 'choice'; options: ReadonlyArray<{ value: string; label: string }> };

export interface SettingsFormOptions {
  fields: SettingField[];
  get: () => Record<string, unknown>;
  /** Applies a change; returns whether it was also stored. */
  change: (patch: Record<string, unknown>) => boolean;
  /** Status texts (already translated). */
  status?: { saved: string; unsaved: string; reset?: string };
  /** Reset button: its label and the values it restores. */
  reset?: { label: string; values: Record<string, unknown> };
}

export interface SettingsForm {
  readonly root: HTMLElement;
  /** Re-reads every value from `get()`. */
  refresh(): void;
}

let serial = 0;

export function createSettingsForm(options: SettingsFormOptions): SettingsForm {
  const root = make('div', 'cp-settings'),
    status = make('div', 'cp-settings-status'),
    refreshers: Array<(values: Record<string, unknown>) => void> = [];
  status.setAttribute('role', 'status');
  const say = (saved: boolean, text?: string) => {
    if (options.status) status.textContent = text ?? (saved ? options.status.saved : options.status.unsaved);
  };
  const apply = (patch: Record<string, unknown>) => {
    say(options.change(patch));
    refresh();
  };
  for (const field of options.fields) {
    const id = `cp-setting-${++serial}`,
      row = make(field.type === 'choice' ? 'div' : 'label', 'cp-setting cp-setting-' + field.type),
      text = make('span', 'cp-setting-label', field.label);
    if (field.note) text.append(make('small', '', field.note));
    row.append(text);
    if (field.type === 'range') {
      const wrap = make('div', 'cp-setting-control'),
        input = make('input'),
        out = make('output');
      input.type = 'range';
      input.id = id;
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.dataset.setting = field.key;
      (row as HTMLLabelElement).htmlFor = id;
      input.addEventListener('input', () => apply({ [field.key]: Number(input.value) }));
      wrap.append(input, out);
      row.append(wrap);
      refreshers.push((values) => {
        const value = Number(values[field.key]);
        input.value = String(value);
        out.textContent = field.format ? field.format(value) : String(value);
      });
    } else if (field.type === 'toggle') {
      const input = make('input');
      input.type = 'checkbox';
      input.id = id;
      input.setAttribute('role', 'switch');
      input.dataset.setting = field.key;
      (row as HTMLLabelElement).htmlFor = id;
      input.addEventListener('change', () => apply({ [field.key]: input.checked }));
      row.append(input);
      refreshers.push((values) => (input.checked = Boolean(values[field.key])));
    } else {
      const group = make('div', 'cp-setting-choices');
      group.setAttribute('role', 'radiogroup');
      const buttons = field.options.map((option) => {
        const button = make('button', '', option.label);
        button.type = 'button';
        button.dataset.value = option.value;
        press(button, () => apply({ [field.key]: option.value }));
        group.append(button);
        return button;
      });
      row.append(group);
      refreshers.push((values) => {
        for (const button of buttons) {
          const on = button.dataset.value === values[field.key];
          button.classList.toggle('on', on);
          button.setAttribute('aria-checked', String(on));
        }
      });
    }
    root.append(row);
  }
  const foot = make('div', 'cp-settings-foot');
  foot.append(status);
  if (options.reset) {
    const button = make('button', 'cp-settings-reset', options.reset.label);
    button.type = 'button';
    press(button, () => {
      const saved = options.change({ ...options.reset!.values });
      refresh();
      say(saved, saved ? (options.status?.reset ?? options.status?.saved) : options.status?.unsaved);
    });
    foot.append(button);
  }
  root.append(foot);
  function refresh() {
    const values = options.get();
    for (const fn of refreshers) fn(values);
  }
  refresh();
  if (options.status) status.textContent = options.status.saved;
  return { root, refresh };
}
