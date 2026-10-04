// Set theme and look before first paint to avoid a flash.
(function () {
  var root = document.documentElement;
  // Refuse to run inside someone else's frame (clickjacking). Headers cannot be set on this host, so this is done here.
  try { if (window.top !== window.self) { root.style.display = 'none'; window.top.location = window.self.location; } } catch (e) { root.style.display = 'none'; }
  try {
    var t = localStorage.getItem('forgetools:theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    var skin = localStorage.getItem('forgetools:skin') === 'classic' ? 'classic' : 'terminal';
    if (skin === 'terminal') t = 'dark';
    root.setAttribute('data-skin', skin);
    root.setAttribute('data-motion', localStorage.getItem('forgetools:motion') === 'off' ? 'off' : 'on');
    root.setAttribute('data-theme', t);
    var raw = localStorage.getItem('forgetools:look');
    if (raw) {
      var v = JSON.parse(raw);
      var sets = [v.common || {}, (t === 'light' ? v.light : v.dark) || {}];
      for (var i = 0; i < sets.length; i++) for (var k in sets[i]) root.style.setProperty(k, sets[i][k]);
    }
  } catch (e) {
    if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', 'dark');
    if (!root.getAttribute('data-skin')) root.setAttribute('data-skin', 'terminal');
  }
})();
