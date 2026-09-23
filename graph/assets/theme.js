(function () {
  'use strict';
  var key = 'mp-demo-theme', current = 'dark';
  var colors = {dark:'#0b1118', light:'#edf0e9', paper:'#dfd5bf'};
  function valid(value) { return Object.prototype.hasOwnProperty.call(colors, value); }
  function sendToMap() {
    var frame = document.getElementById('expert-frame');
    if (frame && frame.contentWindow) frame.contentWindow.postMessage({type:'mp-graph-theme',theme:current}, '*');
  }
  function apply(value, remember) {
    if (!valid(value)) return;
    current = value;
    document.documentElement.dataset.theme = value;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = colors[value];
    document.querySelectorAll('[data-theme-choice]').forEach(function(button) {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === value));
    });
    if (remember) { try { localStorage.setItem(key, value); } catch (e) { /* file/private storage can be unavailable */ } }
    sendToMap();
  }
  try { var stored = localStorage.getItem(key); if (valid(stored)) current = stored; } catch (e) { /* dark default */ }
  apply(current, false);
  function ready() {
    apply(current, false);
    var frame = document.getElementById('expert-frame');
    if (frame) frame.addEventListener('load', sendToMap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
  document.addEventListener('click', function(event) {
    var button = event.target.closest('[data-theme-choice]');
    if (button) apply(button.dataset.themeChoice, true);
  });
  window.addEventListener('storage', function(event) { if (event.key === key) apply(event.newValue || 'dark', false); });
  window.addEventListener('message', function(event) {
    if (window.parent !== window && event.source === window.parent && event.data && event.data.type === 'mp-graph-theme') apply(event.data.theme, false);
  });
})();
