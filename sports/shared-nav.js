(function () {
  var depth = location.pathname.replace(/^\/sports\/?/, '').split('/').filter(Boolean).length;
  var pathPrefix = depth > 0 ? '../'.repeat(depth) : '';

  const navEl = document.querySelector('[data-shared-nav]');
  if (navEl) {
    navEl.innerHTML =
      '<nav class="shared-nav" aria-label="Primary navigation">' +
        '<a class="shared-brand" href="/">Wake Up &amp; Produce</a>' +
        '<button class="nav-hamburger" aria-label="Toggle navigation menu" aria-expanded="false">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<div class="shared-nav-links">' +
          '<a href="/sports/">Home</a>' +
          '<a href="/sports/offense-guide/">Offense</a>' +
          '<a href="/sports/defense-guide/">Defense</a>' +
          '<a href="/sports/offensive-key-actions/">Key Actions</a>' +
          '<a href="/sports/key-terms/">Key Terms</a>' +
          '<a href="/sports/learning/">The Lab</a>' +
          '<a href="/sports/standard/">The Standard</a>' +
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

    if (!document.body.hasAttribute('data-no-wip')) {
      var banner = document.createElement('div');
      banner.className = 'wip-banner';
      banner.textContent = '* Animations and diagrams are a work in progress and may be inaccurate.';
      navEl.insertAdjacentElement('afterend', banner);
    }
  }

  var footerEl = document.querySelector('[data-shared-footer]');
  if (footerEl) {
    footerEl.innerHTML = '<footer class="shared-footer"><a href="/">Wake Up &amp; Produce</a><span>Built by Misfit Island, LLC</span></footer>';
  }
}());
