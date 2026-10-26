/* reception.js
   Uses getState / freeSlots / addAppointment / nextTicket from data.js when they exist.
   If data.js is missing, a small localStorage fallback below makes this page work on its own.
   queue-tv.html reads the same key (clinic_state). */
const KEY = 'clinic_state';

function seedState() {
  return {
    doctors: [
      { id: 'd1', name: 'ნინო ქავთარაძე', room: 1 },
      { id: 'd2', name: 'გიორგი მამულაშვილი', room: 2 },
      { id: 'd3', name: 'თამარ ჯაფარიძე', room: 3 }
    ],
    patients: ['ნინო გელაშვილი', 'მარიამ ბერიძე', 'დავით ლომიძე', 'ანა წერეთელი', 'ლევან აბაშიძე'],
    services: ['კონსულტაცია', 'ლაზერული პროცედურა', 'ულტრაბგერა', 'მეზოთერაპია'],
    appts: [
      { id: 1, doctorId: 'd3', time: '10:00', patient: 'ნინო გელაშვილი', service: 'კონსულტაცია', status: 'booked', ticket: null, source: 'web' },
      { id: 2, doctorId: 'd1', time: '09:00', patient: 'დავით ლომიძე', service: 'ულტრაბგერა', status: 'done', ticket: 'A-001' },
      { id: 3, doctorId: 'd1', time: '10:30', patient: 'ანა წერეთელი', service: 'მეზოთერაპია', status: 'booked', ticket: null },
      { id: 4, doctorId: 'd2', time: '09:30', patient: 'ლევან აბაშიძე', service: 'კონსულტაცია', status: 'booked', ticket: null },
      { id: 5, doctorId: 'd2', time: '11:00', patient: 'მარიამ ბერიძე', service: 'ლაზერული პროცედურა', status: 'booked', ticket: null }
    ],
    ticketCounter: 1,
    calls: [],
    lastCalled: null
  };
}
function loadLocal() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.doctors) return s; } catch (e) {}
  const s = seedState(); localStorage.setItem(KEY, JSON.stringify(s)); return s;
}
const saveLocal = s => localStorage.setItem(KEY, JSON.stringify(s));

const api = {
  getState: window.getState || loadLocal,
  freeSlots: window.freeSlots || function (doctorId) {
    const s = loadLocal(), taken = s.appts.filter(a => a.doctorId === doctorId).map(a => a.time), out = [];
    for (let m = 9 * 60; m < 17 * 60; m += 30) {
      const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + (m % 60 ? '30' : '00');
      if (!taken.includes(t)) out.push(t);
    }
    return out;
  },
  addAppointment: window.addAppointment || function (a) {
    const s = loadLocal(); s.appts.push({ id: Date.now(), status: 'booked', ticket: null, ...a }); saveLocal(s);
  },
  nextTicket: window.nextTicket || function () {
    const s = loadLocal(), n = ++s.ticketCounter; saveLocal(s);
    return 'A-' + String(n).padStart(3, '0');
  }
};

const $ = id => document.getElementById(id);
const STATUS_LABEL = { booked: 'ჩაწერილი', arrived: 'მოვიდა', 'in-room': 'კაბინეტშია', done: 'დასრულებულია' };

function toast(t) {
  const e = $('toast'); e.textContent = t; e.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 3000);
}

function render() {
  const s = api.getState();
  $('cols').innerHTML = s.doctors.map(d => {
    const list = s.appts.filter(a => a.doctorId === d.id).sort((a, b) => a.time.localeCompare(b.time));
    return `<div class="col"><h3>${d.name}<small>ოთახი ${d.room}</small></h3>` +
      (list.map(a => `<div class="appt ${a.status}">
        <span class="t">${a.time}</span> · <b>${a.patient}</b><br>${a.service}
        ${a.ticket ? `<br>ნომერი: <b>${a.ticket}</b>` : ''}
        ${a.status === 'booked' ? `<br><button data-arrive="${a.id}">მოვიდა</button>` : `<br><small>${STATUS_LABEL[a.status]}</small>`}
      </div>`).join('') || '<p class="empty">ჩაწერები არ არის</p>') + '</div>';
  }).join('');

  $('queue').innerHTML = s.doctors.map(d => {
    const w = s.appts.filter(a => a.doctorId === d.id && a.status === 'arrived')
      .sort((a, b) => String(a.ticket).localeCompare(String(b.ticket)));
    return `<div class="q"><p>${d.name} · ოთახი ${d.room}</p>
      ${w.length ? '<ul>' + w.map(a => `<li><b>${a.ticket}</b> ${a.patient}</li>`).join('') + '</ul>' : '<p class="empty">რიგში არავინაა</p>'}
      <button data-next="${d.id}" ${w.length ? '' : 'disabled'}>შემდეგის გამოძახება</button></div>`;
  }).join('') + (s.lastCalled ? `<p class="empty">ბოლო გამოძახება: <b>${s.lastCalled.ticket}</b> → ოთახი ${s.lastCalled.room}</p>` : '');
}

document.addEventListener('click', e => {
  const ar = e.target.closest('[data-arrive]');
  if (ar) {
    const ticket = api.nextTicket(), s = api.getState();
    const a = s.appts.find(x => String(x.id) === ar.dataset.arrive);
    a.status = 'arrived'; a.ticket = ticket; saveLocal(s); render();
    toast(`${a.patient}: რიგის ნომერია ${ticket}`);
  }
  const nx = e.target.closest('[data-next]');
  if (nx) {
    const s = api.getState(), d = s.doctors.find(x => x.id === nx.dataset.next);
    s.appts.filter(a => a.doctorId === d.id && a.status === 'in-room').forEach(a => a.status = 'done');
    const w = s.appts.filter(a => a.doctorId === d.id && a.status === 'arrived')
      .sort((a, b) => String(a.ticket).localeCompare(String(b.ticket)));
    if (!w.length) return;
    w[0].status = 'in-room';
    s.lastCalled = { ticket: w[0].ticket, room: d.room };
    s.calls = (s.calls || []).concat({ id: Date.now(), ticket: w[0].ticket, room: d.room });
    saveLocal(s); render();
    toast(`გამოძახებულია ${w[0].ticket} → ოთახი ${d.room}`);
  }
});

// New booking modal
function fillSlots() {
  const slots = api.freeSlots($('fDoc').value);
  $('fSlot').innerHTML = slots.map(t => `<option>${t}</option>`).join('') || '<option value="">თავისუფალი დრო არ არის</option>';
}
$('newBtn').onclick = () => {
  const s = api.getState();
  $('fPat').innerHTML = s.patients.map(p => `<option>${p}</option>`).join('');
  $('fSrv').innerHTML = s.services.map(p => `<option>${p}</option>`).join('');
  $('fDoc').innerHTML = s.doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  fillSlots(); $('dlg').showModal();
};
$('fDoc').onchange = fillSlots;
$('cancel').onclick = () => $('dlg').close();
$('save').onclick = () => {
  if (!$('fSlot').value) return toast('აირჩიეთ თავისუფალი დრო');
  api.addAppointment({ doctorId: $('fDoc').value, time: $('fSlot').value, patient: $('fPat').value, service: $('fSrv').value });
  $('dlg').close(); render(); toast('პაციენტი ჩაწერილია');
};
$('reset').onclick = () => { saveLocal(seedState()); render(); toast('დემო თავიდან დაიწყო'); };

render();
setInterval(render, 2000); // picks up bookings made in other tabs
