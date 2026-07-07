document.addEventListener('DOMContentLoaded', function () {
  var themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      try { localStorage.setItem('bc-theme', isDark ? 'light' : 'dark'); } catch (e) {}
    });
  }

  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', function () {
      var wasOpen = item.classList.contains('open');
      item.parentElement.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  var API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080/backend'
    : 'https://port.radilov-k.workers.dev';

  var form = document.querySelector('#contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('.form-status');
      var submitBtn = form.querySelector('button[type="submit"]');
      var payload = {
        name: form.querySelector('#name').value,
        organization: form.querySelector('#org').value,
        email: form.querySelector('#email').value,
        topic: form.querySelector('#topic').value,
        message: form.querySelector('#msg').value,
        source: 'biocode/contact.html'
      };

      if (submitBtn) submitBtn.disabled = true;
      if (status) {
        status.style.color = 'var(--teal-bright)';
        status.textContent = 'Sending your inquiry…';
        status.style.display = 'block';
      }

      fetch(API_URL + '/api/biocode-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          if (!response.ok) throw new Error('Request failed');
          return response.json();
        })
        .then(function () {
          if (status) {
            status.style.color = 'var(--teal-bright)';
            status.textContent = 'Thank you. Your inquiry has been received — our team responds to research and distribution inquiries within two business days.';
          }
          form.reset();
        })
        .catch(function () {
          if (status) {
            status.style.color = 'var(--amber)';
            status.textContent = 'We could not send your inquiry right now. Please email us directly at info@biocode-peptides.com.';
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  var year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
});
