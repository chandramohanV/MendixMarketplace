// Page and API helpers shared by the e2e suites. Every helper takes the page (or API base) explicitly.

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Polls `fn` until it returns truthy or the timeout passes. Errors count as "not yet". */
export async function waitFor(fn, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return true;
    } catch {
      // Element not there yet: retry.
    }
    await sleep(60);
  }
  return false;
}

export const text = (page, selector) => page.$eval(selector, (e) => e.innerText);
export const count = (page, selector) => page.$$eval(selector, (e) => e.length);

/** Clicks the first element matching `selector` whose text includes `label`. */
export async function clickText(page, selector, label) {
  for (const el of await page.$$(selector)) {
    if ((await el.evaluate((x) => x.innerText.trim())).includes(label)) {
      await el.click();
      return true;
    }
  }
  return false;
}

/** Replaces an input's value by typing (fires real key events, like a user). */
export async function fill(page, selector, value) {
  await page.$eval(selector, (el) => {
    el.focus();
    el.select?.();
  });
  await page.keyboard.press('Backspace');
  if (value) await page.type(selector, value);
}

/** Sets a value React will notice for inputs that can't be typed into reliably (date inputs, selects). */
export const setNativeValue = (page, selector, value) =>
  page.$eval(
    selector,
    (el, v) => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );

/** Puts a generated file of `size` bytes into a file input (no disk access). */
export const setFile = (page, selector, fileName, size) =>
  page.evaluate(
    (sel, name, bytes) => {
      const input = document.querySelector(sel);
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], name));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    selector,
    fileName,
    size,
  );

/** Reads and parses a localStorage value in the page (null when missing). */
export const readStorage = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);

/** Minimal Studio API client for reading expected values and setting up state. */
export function apiClient(apiBase) {
  return {
    async get(path) {
      const res = await fetch(apiBase + path);
      return { status: res.status, body: res.status === 204 ? null : await res.json() };
    },
    async json(path) {
      return (await fetch(apiBase + path)).json();
    },
    async send(method, path, body) {
      const res = await fetch(apiBase + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.status;
    },
  };
}
