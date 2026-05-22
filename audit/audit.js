/* GAISSINA Audit — логика формы и чек-листа */
(function(){
  "use strict";

  // ============ ОБЩЕЕ ============
  var SS = window.sessionStorage;

  function $(s, root){ return (root||document).querySelector(s); }
  function $$(s, root){ return Array.prototype.slice.call((root||document).querySelectorAll(s)); }
  function fmtPct(p){ return (Math.round(p*10)/10).toString().replace('.', ',') + '%'; }
  function todayISO(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  // ============ СТРАНИЦА ВХОДА ============
  function initEntry(){
    var pwdGate = $('#pwd-gate');
    var form = $('#start-form');
    var pwdInput = $('#pwd-input');
    var pwdBtn = $('#pwd-btn');
    var pwdErr = $('#pwd-err');

    // если пароль уже вводили в этой сессии — пропускаем
    if (SS.getItem('audit_authed') === '1') {
      pwdGate.style.display = 'none';
      form.style.display = 'block';
    }

    pwdBtn.addEventListener('click', function(){
      if (pwdInput.value === window.AUDIT_PASSWORD) {
        SS.setItem('audit_authed', '1');
        pwdGate.style.display = 'none';
        form.style.display = 'block';
        pwdErr.textContent = '';
      } else {
        pwdErr.textContent = 'Неверный пароль';
        pwdInput.value = '';
        pwdInput.focus();
      }
    });
    pwdInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter') pwdBtn.click();
    });

    // заполнить список магазинов
    var storeSel = $('#store');
    window.AUDIT_STORES.forEach(function(s){
      var opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      storeSel.appendChild(opt);
    });

    // дата сегодня
    $('#date-show').textContent = todayISO();

    $('#go-btn').addEventListener('click', function(){
      var store = storeSel.value;
      var auditor = $('#auditor').value.trim();
      var director = $('#director').value.trim();
      var startErr = $('#start-err');
      if (!store) { startErr.textContent = 'Выберите магазин'; return; }
      if (!auditor) { startErr.textContent = 'Укажите ваше имя'; return; }
      if (!director) { startErr.textContent = 'Укажите имя директора магазина'; return; }
      startErr.textContent = '';

      var visit = {
        date: todayISO(),
        store: store, auditor: auditor, director: director,
        statuses: {}, comments: {}
      };
      SS.setItem('audit_visit', JSON.stringify(visit));
      location.href = 'checklist.html';
    });
  }

  // ============ ЧЕК-ЛИСТ ============
  function initChecklist(){
    // защита: без авторизации и без visit — на главную аудита
    if (SS.getItem('audit_authed') !== '1' || !SS.getItem('audit_visit')) {
      location.href = 'index.html'; return;
    }
    var visit = JSON.parse(SS.getItem('audit_visit'));

    // шапка
    $('#vh-store').textContent = visit.store;
    $('#vh-auditor').textContent = visit.auditor;
    $('#vh-director').textContent = visit.director;
    $('#vh-date').textContent = visit.date;

    // рендер секций
    var container = $('#sections');
    var globalNum = 0;
    var totalApplicable = 0; // всего пунктов
    window.AUDIT_DATA.forEach(function(sec, si){
      var sectionEl = document.createElement('div');
      sectionEl.className = 'audit-section';
      sectionEl.dataset.section = si;

      var sNum = String(si+1).padStart(2,'0');
      var headHTML =
        '<div class="audit-section-h">' +
          '<span class="as-n">' + sNum + '</span>' +
          '<span class="as-t">' + sec.section + '</span>' +
          '<span class="as-prog" data-sec-prog>0 / ' + sec.items.length + '</span>' +
        '</div>';
      sectionEl.innerHTML = headHTML;

      sec.items.forEach(function(text){
        globalNum++;
        var itemId = 'i' + globalNum;
        var saved = visit.statuses[itemId];
        var savedComment = visit.comments[itemId] || '';

        var item = document.createElement('div');
        item.className = 'audit-item';
        item.dataset.itemId = itemId;
        item.dataset.sec = si;
        item.innerHTML =
          '<div class="audit-item-row">' +
            '<div class="audit-item-num">' + globalNum + '</div>' +
            '<div class="audit-item-text">' + escapeHtml(text) + '</div>' +
            '<div class="audit-item-btns">' +
              '<button class="choice" data-val="yes" title="Выполняется">✓</button>' +
              '<button class="choice" data-val="no" title="Не выполняется">✕</button>' +
              '<button class="choice" data-val="na" title="Не применимо">—</button>' +
            '</div>' +
          '</div>' +
          '<textarea class="audit-comment" placeholder="Комментарий (опционально)…">' + escapeHtml(savedComment) + '</textarea>';
        sectionEl.appendChild(item);

        // навешиваем сохранённое состояние
        if (saved) {
          var btn = item.querySelector('.choice[data-val="'+saved+'"]');
          if (btn) btn.classList.add('active', saved);
          if (saved === 'no' || savedComment) {
            item.querySelector('.audit-comment').classList.add('show');
          }
        }
      });
      container.appendChild(sectionEl);
      totalApplicable += sec.items.length;
    });

    // обработчики выбора
    container.addEventListener('click', function(e){
      var b = e.target.closest('.choice');
      if (!b) return;
      var item = b.closest('.audit-item');
      var val = b.dataset.val;
      var prev = visit.statuses[item.dataset.itemId];
      // toggle off, если повторно
      if (prev === val) {
        delete visit.statuses[item.dataset.itemId];
        item.querySelectorAll('.choice').forEach(function(x){ x.className = 'choice'; });
        item.querySelector('.audit-comment').classList.remove('show');
      } else {
        visit.statuses[item.dataset.itemId] = val;
        item.querySelectorAll('.choice').forEach(function(x){
          x.className = 'choice' + (x.dataset.val === val ? ' active ' + val : '');
        });
        // показать комментарий для «не выполняется»
        var c = item.querySelector('.audit-comment');
        if (val === 'no') c.classList.add('show');
        else if (val === 'na' || val === 'yes') {
          if (!c.value) c.classList.remove('show');
        }
      }
      SS.setItem('audit_visit', JSON.stringify(visit));
      updateProgress();
    });

    // комментарии — автосохранение
    container.addEventListener('input', function(e){
      if (!e.target.classList.contains('audit-comment')) return;
      var item = e.target.closest('.audit-item');
      visit.comments[item.dataset.itemId] = e.target.value;
      SS.setItem('audit_visit', JSON.stringify(visit));
    });

    function updateProgress(){
      var yes=0, no=0, na=0, ans=0;
      Object.values(visit.statuses).forEach(function(v){
        if (v==='yes') yes++; else if (v==='no') no++; else if (v==='na') na++;
      });
      ans = yes + no + na;
      var applicable = yes + no;
      var pct = applicable > 0 ? (yes/applicable*100) : 0;

      $('#bar-pct').textContent = applicable > 0 ? fmtPct(pct) : '—';
      $('#bar-yes').textContent = yes;
      $('#bar-no').textContent = no;
      $('#bar-na').textContent = na;
      $('#bar-of').textContent = ans + ' / ' + window.AUDIT_TOTAL;

      var submit = $('#submit-btn');
      submit.disabled = (ans !== window.AUDIT_TOTAL);
      submit.textContent = (ans === window.AUDIT_TOTAL)
        ? 'Сохранить аудит'
        : 'Отметьте все пункты (' + (window.AUDIT_TOTAL - ans) + ' осталось)';

      // секционный прогресс
      $$('.audit-section').forEach(function(sec){
        var si = +sec.dataset.section;
        var marked = 0;
        $$('.audit-item', sec).forEach(function(it){
          if (visit.statuses[it.dataset.itemId]) marked++;
        });
        sec.querySelector('[data-sec-prog]').textContent = marked + ' / ' + window.AUDIT_DATA[si].items.length;
      });
    }
    updateProgress();

    // отправка
    $('#submit-btn').addEventListener('click', submitAudit);
  }

  function submitAudit(){
    var visit = JSON.parse(SS.getItem('audit_visit'));
    var btn = $('#submit-btn');
    btn.disabled = true;
    btn.textContent = 'Отправка…';

    // собрать payload
    var items = [];
    var idx = 0;
    var yes=0, no=0, na=0;
    window.AUDIT_DATA.forEach(function(sec, si){
      sec.items.forEach(function(text){
        idx++;
        var iid = 'i'+idx;
        var st = visit.statuses[iid] || '';
        var c = visit.comments[iid] || '';
        if (st === 'yes') yes++; else if (st === 'no') no++; else if (st === 'na') na++;
        items.push({
          section: (si+1) + '. ' + sec.section,
          num: idx,
          text: text,
          status: st,
          comment: c
        });
      });
    });
    var applicable = yes + no;
    var pct = applicable > 0 ? Math.round(yes/applicable*1000)/10 : 0;

    var payload = {
      date: visit.date,
      store: visit.store,
      auditor: visit.auditor,
      director: visit.director,
      pct: pct,
      yes: yes, no: no, na: na, applicable: applicable, total: items.length,
      items: items
    };

    var endpoint = window.AUDIT_ENDPOINT;
    if (!endpoint || endpoint.indexOf('PASTE_APPS_SCRIPT') === 0) {
      // тестовый режим: сохранение в Таблицу ещё не подключено
      console.log('TEST MODE — payload:', payload);
      showDone(payload, true);
      return;
    }

    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors', // Apps Script принимает no-cors POST
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function(){
      showDone(payload, false);
    }).catch(function(err){
      btn.disabled = false;
      btn.textContent = 'Сохранить аудит';
      alert('Не удалось отправить: ' + err.message);
    });
  }

  function showDone(payload, testMode){
    SS.removeItem('audit_visit');
    var c = $('#audit-content');
    var bar = $('.audit-bar');
    if (bar) bar.style.display = 'none';
    c.innerHTML =
      '<div class="audit-done">' +
        (testMode ? '<div class="err-msg" style="margin-bottom:24px">⚠ Тестовый режим. Apps Script не подключён — данные не сохранены в Таблицу. Это нормально до завершения настройки.</div>' : '') +
        '<h2>Аудит сохранён</h2>' +
        '<div class="sub">' + payload.store + ' · ' + payload.date + '</div>' +
        '<div class="big">' + fmtPct(payload.pct) + '</div>' +
        '<div class="sub">' +
          'Выполнено: <b>' + payload.yes + '</b> · ' +
          'Не выполнено: <b>' + payload.no + '</b> · ' +
          'Не применимо: <b>' + payload.na + '</b>' +
        '</div>' +
        '<div class="actions">' +
          '<a class="btn" href="index.html">Новый аудит</a>' +
          '<a class="btn ghost" href="../index.html">На главную академии</a>' +
        '</div>' +
      '</div>';
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  // ============ Авто-запуск по странице ============
  if (document.body && document.body.dataset.page === 'entry') initEntry();
  if (document.body && document.body.dataset.page === 'checklist') initChecklist();

  // прогресс чтения (как в академии)
  var bar = document.querySelector('.progress span');
  if (bar) {
    window.addEventListener('scroll', function(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    }, { passive:true });
  }
})();
