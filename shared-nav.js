(function () {
  var depth = location.pathname.split('/').filter(Boolean).length;
  var pathPrefix = depth > 0 ? '../'.repeat(depth) : '';

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
          '<a href="' + pathPrefix + 'offense-guide/">Offense</a>' +
          '<a href="' + pathPrefix + 'defense-guide/">Defense</a>' +
          '<a href="' + pathPrefix + 'offensive-key-actions/">Key Actions</a>' +
          '<a href="' + pathPrefix + 'key-terms/">Key Terms</a>' +
          '<a href="' + pathPrefix + 'learning/">The Lab</a>' +
          '<a href="' + pathPrefix + 'standard/">The Standard</a>' +
          '<a href="' + pathPrefix + 'grinnell-tracker/">Calculator</a>' +
          '<div class="nav-resource-group">' +
            '<button class="nav-resource-toggle" type="button" aria-expanded="false" aria-controls="other-resources-menu">Other Resources<span aria-hidden="true">v</span></button>' +
            '<div class="nav-resource-menu" id="other-resources-menu">' +
              '<a href="https://wakeupandproduce.zohocs.com/" target="_blank" rel="noopener">The Producer Community</a>' +
              '<a href="https://www.youtube.com/playlist?list=PLpHNJgi9uGrlzcQB8ElVVGjYvUo1mnVDY" target="_blank" rel="noopener">Video Library</a>' +
              '<a href="https://pocketcoach.training" target="_blank" rel="noopener">Pocket Coach</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</nav>';

    var sharedNav = navEl.querySelector('.shared-nav');
    var hamburger = navEl.querySelector('.nav-hamburger');
    var resourceToggle = navEl.querySelector('.nav-resource-toggle');
    var resourceGroup = navEl.querySelector('.nav-resource-group');

    function closeResources() {
      if (resourceGroup && resourceToggle) {
        resourceGroup.classList.remove('open');
        resourceToggle.setAttribute('aria-expanded', 'false');
      }
    }

    if (resourceToggle && resourceGroup) {
      resourceToggle.addEventListener('click', function () {
        var open = resourceGroup.classList.toggle('open');
        resourceToggle.setAttribute('aria-expanded', open);
      });
    }

    if (hamburger) {
      hamburger.addEventListener('click', function () {
        var open = sharedNav.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', open);
        if (!open) {
          closeResources();
        }
      });
      document.addEventListener('click', function (e) {
        if (!sharedNav.contains(e.target)) {
          sharedNav.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
          closeResources();
        }
      });
    }
  }

  var footerEl = document.querySelector('[data-shared-footer]');
  if (footerEl) {
    footerEl.innerHTML = '<footer class="shared-footer"><a href="' + pathPrefix + '">Wake Up &amp; Produce</a><span>Built by Baxter</span></footer>';
  }
}());

/* cloudflare-pages-refresh: 2026-05-27 */
