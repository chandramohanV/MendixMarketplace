/**
 * Page buttons to show: the first, the last, and the current page with its neighbours, with "…" for
 * gaps. pageButtons(5, 10) → [1, '…', 4, 5, 6, '…', 10].
 */
export function pageButtons(page: number, pages: number): (number | '…')[] {
  const buttons: (number | '…')[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) buttons.push(i);
    else if (buttons[buttons.length - 1] !== '…') buttons.push('…');
  }
  return buttons;
}
