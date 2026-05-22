/* GAISSINA Retail Academy — навигация и интерактив */
(function () {
  "use strict";

  var BOOKS = [
    { id: "01", file: "01-brand-book.html",       t: "Книга бренда",                ready: true },
    { id: "02", file: "02-selling-book.html",     t: "Книга продаж",                ready: true },
    { id: "03", file: "03-vm-book.html",          t: "Книга мерчандайзинга",        ready: true },
    { id: "04", file: "04-operations-book.html",  t: "Книга операций",              ready: true },
    { id: "05", file: "05-director-book.html",    t: "Книга директора",             ready: true },
    { id: "06", file: "06-hr-training-book.html", t: "Книга персонала и обучения",  ready: true },
    { id: "07", file: "07-kpi-book.html",         t: "Книга показателей",           ready: true },
    { id: "08", file: "08-clienteling-book.html", t: "Книга работы с клиентами",    ready: true },
    { id: "09", file: "09-games-book.html",       t: "Книга обучающих игр",         ready: true }
  ];

  // путь к корню относительно текущей страницы
  var inBooks = /\/books\//.test(location.pathname) || /books[\\/]/.test(location.href);
  var root = inBooks ? "../" : "";
  var booksDir = inBooks ? "" : "books/";

  var current = document.body.getAttribute("data-book") || "";

  /* ---------- боковое меню ---------- */
  var sb = document.getElementById("sidebar");
  if (sb) {
    var links = BOOKS.map(function (b) {
      var cls = "sb-link" + (b.id === current ? " current" : "") + (b.ready ? "" : " soon");
      var badge = b.ready ? "" : '<span class="badge">скоро</span>';
      return (
        '<a class="' + cls + '" href="' + booksDir + b.file + '">' +
        '<span class="n">' + b.id + "</span>" +
        "<span>" + b.t + "</span>" + badge +
        "</a>"
      );
    }).join("");

    sb.innerHTML =
      '<div class="sb-brand">' +
        '<a href="' + root + 'index.html" style="text-decoration:none">' +
          '<div class="sb-mark">GAISSINA</div>' +
          '<div class="sb-sub">Retail Academy</div>' +
        "</a>" +
      "</div>" +
      '<nav class="sb-scroll">' +
        '<div class="sb-cap">Девять книг</div>' +
        links +
        '<div class="sb-cap" style="margin-top:18px">Контроль</div>' +
        '<a class="sb-link" href="' + root + 'audit/index.html">' +
          '<span class="n">✓</span><span>Аудит магазина</span>' +
        '</a>' +
      "</nav>" +
      '<div class="sb-foot">Внутренний документ GAISSINA.<br>Не для передачи третьим лицам.</div>';
  }

  /* ---------- мобильное меню ---------- */
  var btn = document.querySelector(".menu-btn");
  var scrim = document.querySelector(".scrim");
  function close() { document.body.classList.remove("nav-open"); }
  if (btn) btn.addEventListener("click", function () {
    document.body.classList.toggle("nav-open");
  });
  if (scrim) scrim.addEventListener("click", close);
  document.addEventListener("click", function (e) {
    if (e.target.closest(".sb-link")) close();
  });

  /* ---------- прогресс чтения ---------- */
  var bar = document.querySelector(".progress span");
  if (bar) {
    window.addEventListener("scroll", function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
    }, { passive: true });
  }

  /* ---------- год в подвале ---------- */
  var y = document.querySelectorAll("[data-year]");
  for (var i = 0; i < y.length; i++) y[i].textContent = new Date().getFullYear();
})();
