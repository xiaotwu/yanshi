/**
 * Module-level stack of open modals. Nested dialogs (e.g. a provider config modal above
 * Settings) each register here; ESC and similar dismiss gestures may only act on the modal
 * whose token is on top, so one keypress never closes more than one layer.
 */
const stack: symbol[] = [];

export function pushModal(): symbol {
  const token = Symbol("modal");
  stack.push(token);
  return token;
}

export function releaseModal(token: symbol): void {
  const index = stack.indexOf(token);
  if (index >= 0) stack.splice(index, 1);
}

export function isTopModal(token: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === token;
}

export function openModalCount(): number {
  return stack.length;
}
