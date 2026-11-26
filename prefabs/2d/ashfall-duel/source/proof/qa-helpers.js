// Page helpers for the 「灰燼之庭」 pixel scenarios (prefabs/tools/detplay.mjs PRELOAD=…): input the
// way a player gives it, as DOM events, so the same steps drive the original game and the
// viewer preset. window.__qa.key('KeyJ', 'down'|'up'|'tap'), .pointer('down'|'up', x, y),
// .tap(x, y), .button(text) (a menu button by its label, as a keyboard click).
(() => {
  const keyName = { Enter: 'Enter', Escape: 'Escape', Space: ' ', KeyJ: 'j', KeyA: 'a', KeyD: 'd', KeyM: 'm', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' };
  const key = (code, type = 'tap') => {
    for (const kind of type === 'tap' ? ['keydown', 'keyup'] : [type === 'down' ? 'keydown' : 'keyup']) {
      const target = document.activeElement || document.body;
      target.dispatchEvent(new KeyboardEvent(kind, { code, key: keyName[code] || code, bubbles: true, cancelable: true }));
    }
  };
  const pointer = (type, x, y, id = 1) => {
    const target = document.elementFromPoint(x, y);
    target.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: id, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'down' ? 1 : 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  };
  const button = (text) => {
    const found = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text && b.getClientRects().length);
    if (!found) throw Error('no button ' + text);
    found.click();
  };
  window.__qa = { key, pointer, tap: (x, y) => { pointer('down', x, y); pointer('up', x, y); }, button };
})();
