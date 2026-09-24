/* sprite.js — inline SVG icon sprite (an external sprite.svg#id is blocked on file:// in Chromium).
 * Use: <svg class="ico"><use href="#i-play"/></svg>. Icons are 24×24, single colour (currentColor).
 * The illustration package may add symbols here; keep ids stable. */
(function () {
  'use strict';
  var S = {
    'i-play': '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>',
    'i-pause': '<rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/>',
    'i-replay': '<path d="M12 4a8 8 0 1 1-7.75 10h2.1A6 6 0 1 0 12 6v3L7 5l5-4v3z"/>',
    'i-film': '<rect x="2" y="5" width="15" height="14" rx="3"/><path d="M18 10l4-2.5v9L18 14z"/>',
    'i-arrow-down': '<path d="M11 3h2v13.2l4.6-4.6 1.4 1.4-7 7-7-7 1.4-1.4 4.6 4.6z"/>',
    'i-arrow-right': '<path d="M3 11h13.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H3z"/>',
    'i-check': '<path d="M9.5 16.2 4.8 11.5l-1.6 1.6 6.3 6.3L21 7.9l-1.6-1.6z"/>',
    'i-cross': '<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z"/>',
    'i-stamp': '<path d="M9 3h6v4.5c0 1.5 1 2.5 2.2 3.2 1.1.6 1.8 1.4 1.8 2.8V15H5v-1.5c0-1.4.7-2.2 1.8-2.8C8 10 9 9 9 7.5z"/><rect x="4" y="17" width="16" height="4" rx="1.5"/>',
    'i-bell': '<path d="M12 3a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V9a6 6 0 0 0-6-6zm-2.5 15a2.5 2.5 0 0 0 5 0z"/>',
    'i-drop': '<path d="M12 2.5S5 10.2 5 14.5a7 7 0 0 0 14 0C19 10.2 12 2.5 12 2.5z"/>',
    'i-leaf': '<path d="M20 3C9 3 4 8 4 15c0 2 .5 3.5 1 4.5L3.5 21l1 1 1.6-1.5C7 21 8.5 21 10 21c7 0 10-6 10-18zM8 17c2-4 5-7 9-9-3 2.5-6 5.5-9 9z"/>',
    'i-star': '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>',
    'i-gear': '<path d="M13.6 2l.5 2.6 1.9.8 2.2-1.5 2.3 2.3-1.5 2.2.8 1.9 2.6.5v3.2l-2.6.5-.8 1.9 1.5 2.2-2.3 2.3-2.2-1.5-1.9.8-.5 2.6h-3.2l-.5-2.6-1.9-.8-2.2 1.5-2.3-2.3 1.5-2.2-.8-1.9L2 13.6v-3.2l2.6-.5.8-1.9-1.5-2.2 2.3-2.3 2.2 1.5 1.9-.8.5-2.6zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>',
    'i-wrench': '<path d="M21 6.5a5.5 5.5 0 0 1-7.4 5.2L6.3 19a2.1 2.1 0 0 1-3-3l7.3-7.3A5.5 5.5 0 0 1 17.5 3l-3.3 3.3.9 2.6 2.6.9L21 6.5z"/>',
    'i-bolt': '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    'i-moon': '<path d="M20 15.5A8.5 8.5 0 1 1 8.5 4a7 7 0 0 0 11.5 11.5z"/>',
    'i-lamp': '<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 19h6v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5z"/>',
    'i-graph': '<rect x="2" y="3" width="8" height="6" rx="1.5"/><rect x="14" y="15" width="8" height="6" rx="1.5"/><rect x="14" y="3" width="8" height="6" rx="1.5"/><path d="M10 6h4v2h-2v7h2v2h-4z"/>',
    'i-phone': '<rect x="6" y="2" width="12" height="20" rx="3"/><rect x="8" y="5" width="8" height="12" rx="1" fill="#FFF6E6"/>',
    'i-search': '<path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>',
    'i-card': '<rect x="3" y="4" width="18" height="16" rx="3"/>',
    /* added by the illustration package (chars.js kit) */
    'i-plant': '<path d="M7 14h10l-1.4 7.1a1.2 1.2 0 0 1-1.2.9H9.6a1.2 1.2 0 0 1-1.2-.9z"/><path d="M11 13c0-3.2-2.1-5.6-6-5.6 0 3.4 2.2 5.6 6 5.6zm2 0c0-4.1 2.4-7.5 7-7.5 0 4.4-2.8 7.5-7 7.5z"/>',
    'i-factory': '<path d="M2 21V11l5.5 3v-3l5.5 3v-3l3-1.6V3h4v18z"/>',
    'i-lock': '<path fill-rule="evenodd" d="M7 10V7.5a5 5 0 0 1 10 0V10h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7.5a3 3 0 0 0-6 0z"/>',
    'i-clock': '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6z"/><path d="M11 7h2v4.4l3.3 2-1 1.7L11 12.6z"/>',
    'i-sparkle': '<path d="M12 2c.8 5 2.9 7.2 8 8-5.1.8-7.2 3-8 8-.8-5-2.9-7.2-8-8 5.1-.8 7.2-3 8-8zM19 15c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3z"/>'
  };
  var out = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>';
  Object.keys(S).forEach(function (id) { out += '<symbol id="' + id + '" viewBox="0 0 24 24">' + S[id] + '</symbol>'; });
  out += '</defs></svg>';
  function inject() { document.body.insertAdjacentHTML('afterbegin', out); }
  if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);
})();
