(function () {
  var depth = location.pathname.replace(/^\/sports\/?/, '').split('/').filter(Boolean).length;
  var pathPrefix = depth > 0 ? '../'.repeat(depth) : '';
  var sports = [
    { name: 'Basketball', id: 'basketball', href: '/sports/#basketball' },
    { name: 'Football', id: 'football', href: '/sports/#football' },
    { name: 'Volleyball', id: 'volleyball', href: '/sports/#volleyball' },
    { name: 'Baseball', id: 'baseball', href: '/sports/#baseball' },
    { name: 'Soccer', id: 'soccer', href: '/sports/#soccer' },
    { name: 'Track & Field', id: 'track-and-field', href: '/sports/#track-and-field' },
    { name: 'Tennis', id: 'tennis', href: '/sports/#tennis' },
    { name: 'Lacrosse', id: 'lacrosse', href: '/sports/#lacrosse' },
    { name: 'Golf', id: 'golf', href: '/sports/#golf' }
  ];
  var sportSections = {
    basketball: [
      { name: 'Overview', href: '/sports/#basketball' },
      { name: 'Offense', href: '/sports/offense-guide/' },
      { name: 'Defense', href: '/sports/defense-guide/' },
      { name: 'Key Actions', href: '/sports/offensive-key-actions/' },
      { name: 'Key Terms', href: '/sports/key-terms/' },
      { name: 'The Lab', href: '/sports/learning/' },
      { name: 'The Standard', href: '/sports/standard/' }
    ]
  };
  var basketballPaths = Object.keys(sportSections.basketball).map(function (index) {
    return sportSections.basketball[index].href.replace(/\/?$/, '');
  });
  var currentPath = location.pathname.replace(/\/$/, '') || '/';
  var landingSport = sports.filter(function (sport) {
    return sport.id === location.hash.slice(1);
  })[0];
  var currentPrimarySport = landingSport ? landingSport.id : (currentPath === '/sports' || basketballPaths.indexOf(currentPath) !== -1 ? 'basketball' : null);
  var currentSport = basketballPaths.indexOf(currentPath) !== -1 || currentPrimarySport === 'basketball' ? 'basketball' : null;

  // Sport sections currently share the landing page and are selected by hash.
  // Reloading on a hash change lets this central configuration update both nav levels.
  if (currentPath === '/sports') {
    window.addEventListener('hashchange', function () {
      window.location.reload();
    });
  }

  function linkMarkup(link, current) {
    return '<a href="' + link.href + '"' + (current ? ' class="is-active" aria-current="page"' : '') + '>' + link.name + '</a>';
  }

  const navEl = document.querySelector('[data-shared-nav]');
  if (navEl) {
    var primaryLinks = sports.map(function (sport) {
      return linkMarkup(sport, currentPrimarySport === sport.id);
    }).join('');
    var secondaryLinks = currentSport ? sportSections[currentSport].map(function (section) {
      var isOverview = section.name === 'Overview' && currentSport === 'basketball' && currentPath === '/sports';
      return linkMarkup(section, isOverview || currentPath === section.href.replace(/\/$/, ''));
    }).join('') : '';

    navEl.innerHTML =
      '<nav class="shared-nav" aria-label="Sports navigation">' +
        '<div class="nav-primary">' +
          '<div class="shared-brand" aria-label="Breadcrumb">' +
            '<a href="/">Wake Up &amp; Produce</a><span aria-hidden="true">→</span><a href="/sports/"' + (currentPath === '/sports' ? ' aria-current="page"' : '') + '>Varsity Sports Blueprint</a>' +
          '</div>' +
          '<button class="nav-hamburger" aria-label="Toggle navigation menu" aria-expanded="false">' +
            '<span></span><span></span><span></span>' +
          '</button>' +
          '<div class="shared-nav-links nav-primary-links" aria-label="Primary Sports navigation">' + primaryLinks + '</div>' +
        '</div>' +
        (secondaryLinks ? '<div class="sports-secondary"><span class="sports-section-label">Basketball</span><div class="sports-secondary-nav" aria-label="Basketball navigation">' + secondaryLinks + '</div></div>' : '') +
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
