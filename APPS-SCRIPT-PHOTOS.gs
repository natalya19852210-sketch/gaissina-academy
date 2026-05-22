/**
 * GAISSINA Audit — Apps Script (версия с фото)
 *
 * Чем отличается от прошлой версии:
 *  • Принимает фото (до 3 шт. на пункт)
 *  • Сжатые фото сохраняются в Google Drive в папке «GAISSINA Audit Photos»
 *  • Иерархия: /GAISSINA Audit Photos/[дата визита]/[магазин]/файл.jpg
 *  • Каждый файл открывается по ссылке (доступ «у кого есть ссылка — смотреть»)
 *  • В листе «Детали» добавляются 3 столбца: «Фото 1», «Фото 2», «Фото 3»
 *
 * Установка обновления:
 *  1) В Apps Script Вашей Таблицы — открыть Код.gs.
 *  2) Удалить весь старый код (Ctrl+A → Delete).
 *  3) Вставить ВЕСЬ этот файл.
 *  4) Сохранить (Ctrl+S).
 *  5) Развернуть → Управлять развёртываниями → карандаш «Изменить»
 *     → Версия: «Новая версия» → «Развернуть».
 *  6) Google попросит ДОПОЛНИТЕЛЬНОЕ разрешение на доступ к Drive
 *     (для сохранения фото) — согласиться.
 *  7) URL остаётся прежним — мне ничего пересылать не нужно.
 */

// ID Вашей Google Таблицы (где сейчас лежат данные аудита)
var SHEET_ID = '1VCgqwS9ZlTPGJHHAuPQ8e0CV6dwmF82qIxFw0lYZNVE';

var SHEET_VISITS = 'Визиты';
var SHEET_DETAILS = 'Детали';
var SHEET_DASHBOARD = 'Дашборд';
var PHOTO_ROOT_FOLDER = 'GAISSINA Audit Photos';

function getSS() { return SpreadsheetApp.openById(SHEET_ID); }

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = getSS();

    var visits = ensureVisitsSheet(ss);
    var details = ensureDetailsSheet(ss);

    var visitId = Utilities.getUuid().substring(0, 8);
    var ts = new Date();

    visits.appendRow([
      ts,
      data.date || '',
      data.store || '',
      data.auditor || '',
      data.director || '',
      (data.pct || 0) / 100,
      data.applicable || 0,
      data.yes || 0,
      data.no || 0,
      data.na || 0,
      data.total || 0,
      visitId
    ]);

    if (data.items && data.items.length) {
      // подготовим Drive один раз
      var photoCtx = null;
      var hasAnyPhotos = data.items.some(function(it){ return it.photos && it.photos.length; });
      if (hasAnyPhotos) {
        var root = getOrCreateFolder(null, PHOTO_ROOT_FOLDER);
        var dateF = getOrCreateFolder(root, data.date || 'no-date');
        var storeF = getOrCreateFolder(dateF, sanitize(data.store || 'no-store'));
        photoCtx = { folder: storeF, visitId: visitId };
      }

      var rows = data.items.map(function (it) {
        var photoUrls = ['', '', ''];
        if (photoCtx && it.photos && it.photos.length) {
          var saved = savePhotos(it.photos, photoCtx, it.num);
          for (var i = 0; i < 3; i++) photoUrls[i] = saved[i] || '';
        }
        return [
          visitId,
          ts,
          data.store || '',
          data.auditor || '',
          data.director || '',
          it.section || '',
          it.num || '',
          it.text || '',
          statusLabel(it.status),
          it.comment || '',
          photoUrls[0],
          photoUrls[1],
          photoUrls[2]
        ];
      });
      details.getRange(details.getLastRow() + 1, 1, rows.length, 13).setValues(rows);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, id: visitId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'GAISSINA Audit + Photos' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function statusLabel(s) {
  if (s === 'yes') return '✓ выполняется';
  if (s === 'no') return '✕ не выполняется';
  if (s === 'na') return '— не применимо';
  return '';
}

// ============ Сохранение фото в Drive ============
function getOrCreateFolder(parent, name) {
  var iter = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function savePhotos(photos, ctx, itemNum) {
  var urls = [];
  for (var i = 0; i < photos.length && i < 3; i++) {
    var dataUrl = photos[i];
    if (!dataUrl) continue;
    var m = String(dataUrl).match(/^data:(.+?);base64,(.+)$/);
    if (!m) continue;
    var mime = m[1];
    var data = m[2];
    var ext = (mime.split('/')[1] || 'jpg').replace(/[^a-z0-9]+/gi, '');
    var name = ctx.visitId + '_п' + itemNum + '_' + (i + 1) + '.' + ext;
    try {
      var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, name);
      var file = ctx.folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      urls.push(file.getUrl());
    } catch (err) {
      urls.push('ошибка: ' + err);
    }
  }
  return urls;
}

function sanitize(s) {
  return String(s).replace(/[\\\/:*?"<>|]/g, '_').trim();
}

// ============ Подготовка листов ============
function ensureVisitsSheet(ss) {
  var sh = ss.getSheetByName(SHEET_VISITS);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_VISITS);
  var headers = [
    'Отметка времени', 'Дата визита', 'Магазин', 'Аудитор', 'Директор магазина',
    '% итог', 'Применимых пунктов', '✓ Выполнено', '✕ Не выполнено', '— Не применимо',
    'Всего пунктов', 'ID визита'
  ];
  sh.appendRow(headers);
  sh.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold').setBackground('#4B4B4B').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.getRange('F:F').setNumberFormat('0.0%');
  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(3, 220);
  sh.setColumnWidth(4, 180);
  sh.setColumnWidth(5, 180);
  return sh;
}

function ensureDetailsSheet(ss) {
  var sh = ss.getSheetByName(SHEET_DETAILS);
  var needed = [
    'ID визита', 'Отметка времени', 'Магазин', 'Аудитор', 'Директор магазина',
    'Раздел', '№', 'Пункт', 'Статус', 'Комментарий', 'Фото 1', 'Фото 2', 'Фото 3'
  ];
  if (!sh) {
    sh = ss.insertSheet(SHEET_DETAILS);
    sh.appendRow(needed);
    sh.getRange(1, 1, 1, needed.length)
      .setFontWeight('bold').setBackground('#4B4B4B').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(2, 150);
    sh.setColumnWidth(3, 220);
    sh.setColumnWidth(6, 250);
    sh.setColumnWidth(8, 380);
    sh.setColumnWidth(10, 280);
    sh.setColumnWidth(11, 220);
    sh.setColumnWidth(12, 220);
    sh.setColumnWidth(13, 220);
    return sh;
  }
  // Лист уже есть — добавим недостающие колонки «Фото 1..3», если их нет
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  ['Фото 1', 'Фото 2', 'Фото 3'].forEach(function (name) {
    if (hdr.indexOf(name) === -1) {
      var col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(name)
        .setFontWeight('bold').setBackground('#4B4B4B').setFontColor('#ffffff');
      sh.setColumnWidth(col, 220);
    }
  });
  return sh;
}

// ============ Дашборд ============
function setupDashboard() {
  var ss = getSS();
  ensureVisitsSheet(ss);
  ensureDetailsSheet(ss);

  var sh = ss.getSheetByName(SHEET_DASHBOARD);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(SHEET_DASHBOARD, 0);

  sh.getRange('A1').setValue('GAISSINA — Дашборд аудита')
    .setFontSize(18).setFontWeight('bold').setFontFamily('Georgia');
  sh.getRange('A2').setValue('Обновляется автоматически после каждого визита')
    .setFontStyle('italic').setFontColor('#7a7a7a');

  sh.getRange('A4').setValue('РЕЙТИНГ МАГАЗИНОВ').setFontWeight('bold').setBackground('#E7DED2');
  sh.getRange('A5:D5').setValues([['Магазин', 'Визитов', 'Средний %', 'Последний %']])
    .setFontWeight('bold').setBackground('#F6F1EA');
  sh.getRange('A6').setFormula(
    '=IFERROR(SORT(QUERY(Визиты!C2:F, "select C, count(C), avg(F) where C is not null group by C label count(C) \'Визитов\', avg(F) \'Средний %\'", 0), 3, FALSE), "Нет данных")'
  );
  sh.getRange('D6').setFormula(
    '=ARRAYFORMULA(IF(LEN(A6:A), IFERROR(VLOOKUP(A6:A, SORT(Визиты!C2:F, 1, FALSE), 4, FALSE)), ))'
  );
  sh.getRange('C6:D').setNumberFormat('0.0%');

  sh.getRange('F4').setValue('ПО ДИРЕКТОРАМ МАГАЗИНОВ').setFontWeight('bold').setBackground('#E7DED2');
  sh.getRange('F5:I5').setValues([['Магазин', 'Директор', 'Визитов', 'Средний %']])
    .setFontWeight('bold').setBackground('#F6F1EA');
  sh.getRange('F6').setFormula(
    '=IFERROR(QUERY(Визиты!C2:F, "select C, E, count(C), avg(F) where C is not null and E is not null group by C, E order by C, avg(F) desc label count(C) \'Визитов\', avg(F) \'Средний %\'", 0), "Нет данных")'
  );
  sh.getRange('I6:I').setNumberFormat('0.0%');

  sh.getRange('A15').setValue('ПОСЛЕДНИЕ ВИЗИТЫ').setFontWeight('bold').setBackground('#E7DED2');
  sh.getRange('A16:E16').setValues([['Дата', 'Магазин', 'Аудитор', 'Директор', '% итог']])
    .setFontWeight('bold').setBackground('#F6F1EA');
  sh.getRange('A17').setFormula(
    '=IFERROR(SORT(QUERY(Визиты!B2:F, "select B, C, D, E, F where B is not null", 0), 1, FALSE), "Нет данных")'
  );
  sh.getRange('E17:E').setNumberFormat('0.0%');

  sh.getRange('G15').setValue('ТОП ПРОВАЛИВАЕМЫХ ПУНКТОВ').setFontWeight('bold').setBackground('#E7DED2');
  sh.getRange('G16:I16').setValues([['Пункт', 'Раздел', 'Сколько раз ✕']])
    .setFontWeight('bold').setBackground('#F6F1EA');
  sh.getRange('G17').setFormula(
    '=IFERROR(SORT(QUERY(Детали!F2:I, "select H, F, count(H) where I = \'✕ не выполняется\' group by H, F label count(H) \'Раз\'", 0), 3, FALSE), "Нет данных")'
  );

  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 90);
  sh.setColumnWidth(3, 110);
  sh.setColumnWidth(4, 110);
  sh.setColumnWidth(6, 220);
  sh.setColumnWidth(7, 220);
  sh.setColumnWidth(8, 180);
  sh.setColumnWidth(9, 110);

  sh.activate();
  SpreadsheetApp.getActiveSpreadsheet().toast('Дашборд готов', 'GAISSINA Audit');
}
