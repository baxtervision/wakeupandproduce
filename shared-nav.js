(function () {
  const isSubpage = /\/(offensive-key-actions|grinnell-tracker|offense-guide|defense-guide|key-terms|recruiting|learning)\//.test(location.pathname);
  const pathPrefix = isSubpage ? '../' : '';

  const navEl = document.querySelector('[data-shared-nav]');
  if (navEl) {
    navEl.innerHTML =
      '<nav class="shared-nav" aria-label="Primary navigation">' +
        '<a class="shared-brand" href="' + pathPrefix + '">Wake Up &amp; Produce</a>' +
        '<button class="nav-hamburger" aria-label="Toggle navigation menu" aria-expanded="false">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<div class="shared-nav-links">' +
          '<a href="' + pathPrefix + '">Home</a>' +
          '<a href="' + pathPrefix + 'offensive-key-actions/">Key Actions</a>' +
          '<a href="' + pathPrefix + 'offense-guide/">Offense</a>' +
          '<a href="' + pathPrefix + 'defense-guide/">Defense</a>' +
          '<a href="' + pathPrefix + 'key-terms/">Key Terms</a>' +
          '<a href="' + pathPrefix + 'grinnell-tracker/">Grinnell Tracker</a>' +
          '<a href="' + pathPrefix + 'recruiting/">Recruiting</a>' +
          '<a href="' + pathPrefix + 'learning/">Learning</a>' +
        '</div>' +
      '</nav>';

    var sharedNav = navEl.querySelector('.shared-nav');
    var hamburger = navEl.querySelector('.nav-hamburger');
    if (hamburger) {
      hamburger.addEventListener('click', function () {
        var open = sharedNav.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', open);
      });
      document.addEventListener('click', function (e) {
        if (!sharedNav.contains(e.target)) {
          sharedNav.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  var footerEl = document.querySelector('[data-shared-footer]');
  if (footerEl) {
    footerEl.innerHTML = '<footer class="shared-footer"><a href="' + pathPrefix + '">Wake Up &amp; Produce</a><span>Built by Baxter</span></footer>';
  }
}());
