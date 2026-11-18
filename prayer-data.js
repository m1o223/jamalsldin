'use strict';
// Shared display-only fixtures. No city, calculation method, clock or countdown.
(function (root) {
  const data = Object.freeze({
    preview: Object.freeze({
      times: Object.freeze({ fajr: '05:15', dhuhr: '12:30', asr: '15:45', maghrib: '18:10', isha: '19:40' }),
      nextPrayer: Object.freeze({ key: 'asr', name: 'العصر' }),
      remaining: '01:20'
    }),
    prayers: Object.freeze([
      Object.freeze({ key: 'fajr', name: 'الفجر' }),
      Object.freeze({ key: 'dhuhr', name: 'الظهر' }),
      Object.freeze({ key: 'asr', name: 'العصر' }),
      Object.freeze({ key: 'maghrib', name: 'المغرب' }),
      Object.freeze({ key: 'isha', name: 'العشاء' })
    ]),
    topics: Object.freeze({
      wudu: Object.freeze({ title: 'تعلّم الوضوء', prompt: 'أريد تعلّم الوضوء خطوة بخطوة' }),
      salah: Object.freeze({ title: 'تعلّم الصلاة', prompt: 'أريد تعلّم الصلاة خطوة بخطوة' })
    })
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else Object.defineProperty(root, 'JAMAL_PRAYER_DATA', { value: data });
})(globalThis);
