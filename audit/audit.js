/* GAISSINA Audit — логика формы и чек-листа */
(function(){
  "use strict";

  // ============ ОБЩЕЕ ============
  var SS = window.sessionStorage;

  // Фото по itemId. Не сохраняем в sessionStorage (могут быть тяжёлые,
  // лежат в памяти на время сессии аудита).
  var photosByItem = {};
  var MAX_PHOTOS = 3;
  var MAX_PHOTO_DIM = 1280; // макс. сторона
  var JPEG_QUALITY = 0.8;

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

    var storeSel = $('#store');
    window.AUDIT_STORES.forEach(function(s){
      var opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      storeSel.appendChild(opt);
    });

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
      photosByItem = {}; // на всякий случай сбросим
      location.href = 'checklist.html';
    });
  }

  // ============ ЧЕК-ЛИСТ ============
  function initChecklist(){
    if (SS.getItem('audit_authed') !== '1' || !SS.getItem('audit_visit')) {
      location.href = 'index.html'; return;
    }
    var visit = JSON.parse(SS.getItem('audit_visit'));

    $('#vh-store').textContent = visit.store;
    $('#vh-auditor').textContent = visit.auditor;
    $('#vh-director').textContent = visit.director;
    $('#vh-date').textContent = visit.date;

    var container = $('#sections');
    var globalNum = 0;
    window.AUDIT_DATA.forEach(function(sec, si){
      var sectionEl = document.createElement('div');
      sectionEl.className = 'audit-section';
      sectionEl.dataset.section = si;

      var sNum = String(si+1).padStart(2,'0');
      sectionEl.innerHTML =
        '<div class="audit-section-h">' +
          '<span class="as-n">' + sNum + '</span>' +
          '<span class="as-t">' + sec.section + '</span>' +
          '<span class="as-prog" data-sec-prog>0 / ' + sec.items.length + '</span>' +
        '</div>';

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
          '<textarea class="audit-comment" placeholder="Комментарий (опционально)…">' + escapeHtml(savedComment) + '</textarea>' +
          '<div class="audit-photos">' +
            '<label class="photo-add">' +
              '<input type="file" accept="image/*" capture="environment" multiple>' +
              '<span>📷</span><span>Прикрепить фото</span>' +
            '</label>' +
            '<span class="photo-hint">до 3 шт., рекомендуется на визуальные нарушения</span>' +
            '<div class="photo-thumbs"></div>' +
          '</div>';
        sectionEl.appendChild(item);

        if (saved) {
          var btn = item.querySelector('.choice[data-val="'+saved+'"]');
          if (btn) btn.classList.add('active', saved);
          if (saved === 'no' || savedComment) {
            item.querySelector('.audit-comment').classList.add('show');
          }
          if (saved === 'no') {
            item.querySelector('.audit-photos').classList.add('show');
          }
        }
      });
      container.appendChild(sectionEl);
    });

    // ===== клики по статусам =====
    container.addEventListener('click', function(e){
      // удалить фото
      var rm = e.target.closest('.photo-thumb .rm');
      if (rm) {
        var thumb = rm.parentElement;
        var item = thumb.closest('.audit-item');
        var idx = +thumb.dataset.idx;
        var arr = photosByItem[item.dataset.itemId] || [];
        arr.splice(idx, 1);
        photosByItem[item.dataset.itemId] = arr;
        renderThumbs(item);
        return;
      }

      var b = e.target.closest('.choice');
      if (!b) return;
      var item = b.closest('.audit-item');
      var val = b.dataset.val;
      var prev = visit.statuses[item.dataset.itemId];

      if (prev === val) {
        // сняли выбор
        delete visit.statuses[item.dataset.itemId];
        item.querySelectorAll('.choice').forEach(function(x){ x.className = 'choice'; });
        item.querySelector('.audit-comment').classList.remove('show');
        item.querySelector('.audit-photos').classList.remove('show');
      } else {
        visit.statuses[item.dataset.itemId] = val;
        item.querySelectorAll('.choice').forEach(function(x){
          x.className = 'choice' + (x.dataset.val === val ? ' active ' + val : '');
        });
        var c = item.querySelector('.audit-comment');
        var ph = item.querySelector('.audit-photos');
        if (val === 'no') { c.classList.add('show'); ph.classList.add('show'); }
        else {
          if (!c.value) c.classList.remove('show');
          ph.classList.remove('show');
        }
      }
      SS.setItem('audit_visit', JSON.stringify(visit));
      updateProgress();
    });

    // ===== комментарий — автосохранение =====
    container.addEventListener('input', function(e){
      if (e.target.classList.contains('audit-comment')) {
        var item = e.target.closest('.audit-item');
        visit.comments[item.dataset.itemId] = e.target.value;
        SS.setItem('audit_visit', JSON.stringify(visit));
      }
    });

    // ===== выбор файла фото =====
    container.addEventListener('change', function(e){
      if (e.target.tagName !== 'INPUT' || e.target.type !== 'file') return;
      var item = e.target.closest('.audit-item');
      var iid = item.dataset.itemId;
      var arr = photosByItem[iid] || [];
      var files = Array.prototype.slice.call(e.target.files);
      e.target.value = ''; // сбросить, чтобы можно было выбрать те же файлы повторно

      var freeSlots = MAX_PHOTOS - arr.length;
      if (freeSlots <= 0) {
        alert('Максимум ' + MAX_PHOTOS + ' фото на пункт. Удалите лишнее и попробуйте снова.');
        return;
      }
      files.slice(0, freeSlots).forEach(function(file){
        arr.push({ loading: true, name: file.name });
        photosByItem[iid] = arr;
        var slotIdx = arr.length - 1;
        renderThumbs(item);
        compressImage(file, function(dataUrl){
          arr[slotIdx] = { dataUrl: dataUrl, name: file.name };
          renderThumbs(item);
        }, function(err){
          arr.splice(slotIdx, 1);
          renderThumbs(item);
          alert('Не удалось обработать фото: ' + err);
        });
      });
      if (files.length > freeSlots) {
        alert('Добавлено только ' + freeSlots + ' фото (максимум ' + MAX_PHOTOS + ' на пункт).');
      }
    });

    function renderThumbs(item){
      var iid = item.dataset.itemId;
      var arr = photosByItem[iid] || [];
      var box = item.querySelector('.photo-thumbs');
      box.innerHTML = arr.map(function(p, i){
        if (p.loading) {
          return '<div class="photo-thumb processing" data-idx="' + i + '"></div>';
        }
        return '<div class="photo-thumb" data-idx="' + i + '" style="background-image:url(\'' + p.dataUrl + '\')">' +
                 '<button type="button" class="rm" title="Удалить">×</button>' +
               '</div>';
      }).join('');
      // блокировать кнопку добавления, если достигли лимита
      var addBtn = item.querySelector('.photo-add');
      if (arr.length >= MAX_PHOTOS) addBtn.classList.add('disabled');
      else addBtn.classList.remove('disabled');
    }

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

    $('#submit-btn').addEventListener('click', submitAudit);
  }

  // ============ Сжатие изображения ============
  function compressImage(file, onDone, onErr){
    if (!/^image\//.test(file.type)) { onErr && onErr('не изображение'); return; }
    var reader = new FileReader();
    reader.onerror = function(){ onErr && onErr('не удалось прочитать файл'); };
    reader.onload = function(ev){
      var img = new Image();
      img.onerror = function(){ onErr && onErr('не удалось загрузить изображение'); };
      img.onload = function(){
        var w = img.width, h = img.height;
        if (Math.max(w, h) > MAX_PHOTO_DIM) {
          if (w >= h) { h = Math.round(h * MAX_PHOTO_DIM / w); w = MAX_PHOTO_DIM; }
          else { w = Math.round(w * MAX_PHOTO_DIM / h); h = MAX_PHOTO_DIM; }
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try {
          onDone(c.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (err) { onErr && onErr(err.message); }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ============ ОТПРАВКА ============
  function submitAudit(){
    var visit = JSON.parse(SS.getItem('audit_visit'));
    var btn = $('#submit-btn');
    btn.disabled = true;
    btn.textContent = 'Отправка…';

    // проверим, не остались ли необработанные фото
    var stillLoading = false;
    Object.values(photosByItem).forEach(function(arr){
      arr.forEach(function(p){ if (p.loading) stillLoading = true; });
    });
    if (stillLoading) {
      btn.disabled = false;
      btn.textContent = 'Сохранить аудит';
      alert('Подождите — фото ещё обрабатываются. Попробуйте через секунду.');
      return;
    }

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
        var photos = (photosByItem[iid] || [])
          .filter(function(p){ return p && p.dataUrl; })
          .map(function(p){ return p.dataUrl; });
        items.push({
          section: (si+1) + '. ' + sec.section,
          num: idx,
          text: text,
          status: st,
          comment: c,
          photos: photos
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
      console.log('TEST MODE — payload:', payload);
      showDone(payload, true);
      return;
    }

    btn.textContent = 'Отправка…';
    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
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
    photosByItem = {};
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

  // ============ Авто-запуск ============
  if (document.body && document.body.dataset.page === 'entry') initEntry();
  if (document.body && document.body.dataset.page === 'checklist') initChecklist();

  var bar = document.querySelector('.progress span');
  if (bar) {
    window.addEventListener('scroll', function(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    }, { passive:true });
  }
})();
