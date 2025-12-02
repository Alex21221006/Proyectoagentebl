// === CONFIG BACKEND ===
const API_BASE = "/agente_multibanco";

/* ========= Claves de LocalStorage ========= */
const LS = {
  receiptsKey : 'agbl_receipts',
  peopleKey   : 'agbl_people',   // { "DNI": "APELLIDOS NOMBRES" }
  userKey     : 'agbl_user',
  passKey     : 'agbl_pass',
  currentUser : 'agbl_currentUser',
  // key para lista de descripciones por banco
  descKey     : (bank) => `agbl_desc_${String(bank||'').replace(/\W+/g,'_')}`
};

/* ========= Helpers ========= */
const q  = (s) => document.querySelector(s);
const qa = (s) => document.querySelectorAll(s);
const loadJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const saveJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

/* ========= Estado ========= */
let PEOPLE = loadJSON(LS.peopleKey, {}); // { dni: "APELLIDOS NOMBRES" }
const VALID_USERS = {
  "ManuelBL": "260923",
  "VictorBL": "248453"
};

/* ========= Vistas ========= */
const loginView = q('#loginView');
const appView   = q('#appView');

/* ========= Login ========= */
(function initLoginRemember(){
  const u = localStorage.getItem(LS.userKey) || '';
  const p = localStorage.getItem(LS.passKey) || '';
  if (u) { q('#lgUser').value = u; q('#rememberUser').checked = true; }
  if (p) { q('#lgPass').value = p; q('#rememberPass').checked = true; }
})();

q('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = q('#lgUser').value.trim();
  const pass = q('#lgPass').value.trim();

  if (!VALID_USERS[user] || VALID_USERS[user] !== pass) {
    alert('⚠️ Usuario o contraseña incorrectos.');
    return;
  }

  // recordatorios
  if (q('#rememberUser').checked) localStorage.setItem(LS.userKey, user);
  else localStorage.removeItem(LS.userKey);
  if (q('#rememberPass').checked) localStorage.setItem(LS.passKey, pass);
  else localStorage.removeItem(LS.passKey);

  localStorage.setItem(LS.currentUser, user);

  // mostrar app
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');

  // operador = usuario logueado
  setOperatorFromLogin();

  // vista por defecto
  q('#btnAgent').classList.add('active');
  q('#btnReceipts').classList.remove('active');
  showAgent();
});

q('#btnLogout').addEventListener('click', () => {
  localStorage.removeItem(LS.currentUser);
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
});

function setOperatorFromLogin(){
  const user = localStorage.getItem(LS.currentUser) || '';
  const op = q('#agOperator');
  if (op) op.value = user;
}

/* ========= Navegación ========= */
q('#btnAgent').addEventListener('click', ()=>{
  q('#btnAgent').classList.add('active');
  q('#btnReceipts').classList.remove('active');
  showAgent();
});
q('#btnReceipts').addEventListener('click', ()=>{
  q('#btnReceipts').classList.add('active');
  q('#btnAgent').classList.remove('active');
  showReceipts();
});

function showAgent(){
  q('#agentView').classList.remove('hidden');
  q('#receiptsView').classList.add('hidden');
  q('#opDate').value = new Date().toISOString().slice(0,10);
  refreshDescDatalist();
  buildBankFilterOptions();
}

function showReceipts(){
  q('#agentView').classList.add('hidden');
  q('#receiptsView').classList.remove('hidden');
  renderTable();
  buildBankFilterOptions();
}

/* ========= Autocompletar por DNI ========= */
const normalizeDNI = (dni) => (dni||'').replace(/\D/g,'').trim();

function attachDniAutocomplete(dniSel, nameSel){
  const dni  = q(dniSel);
  const name = q(nameSel);
  if (!dni || !name) return;

  // máximo 8 dígitos
  dni.addEventListener('input', ()=>{
    dni.value = normalizeDNI(dni.value).slice(0,8);
  });

  const handler = () => {
    const d = normalizeDNI(dni.value);
    if (d.length >= 8 && PEOPLE[d]) name.value = PEOPLE[d];
  };
  dni.addEventListener('input', handler);
  dni.addEventListener('blur', handler);
}

// Conecta a tus campos reales del HTML
attachDniAutocomplete('#dniSolicitante',  '#nomSolicitante');
attachDniAutocomplete('#dniBeneficiario', '#nomBeneficiario');

/* Botones de lupa: consultar automáticamente a la API de Odoo */
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.dni-lookup');
  if (!btn) return;

  // 🟢 MODO DEMO: si no hay backend configurado, no llamamos a ninguna API
  if (!API_BASE) {
    alert("🛈 Modo demostración: la búsqueda automática por DNI no está disponible.\n" +
          "Puedes escribir el nombre manualmente y el sistema lo recordará para autocompletar.");
    return;
  }

  const inputId = btn.dataset.target;
  const input = document.getElementById(inputId);
  if (!input) return;

  const dni = normalizeDNI(input.value);
  if (dni.length !== 8) {
    alert("Por favor ingresa un DNI válido de 8 dígitos.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/dni`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numero: dni }),
    credentials: "include" // usa la sesión del usuario Odoo
  });

  let data = null;
  try { data = await res.json(); } catch (_) {}

  if (!res.ok || data?.error) {
    alert(data?.error || `Error del backend (${res.status}). Inténtalo más tarde.`);
    return;
  }


    const nameField = inputId.includes("Solicitante")
      ? document.getElementById("nomSolicitante")
      : document.getElementById("nomBeneficiario");

    if (data?.nombreCompleto) {
      nameField.value = data.nombreCompleto;
    } else {
      const posible =
        `${data?.apellidoPaterno || ""} ${data?.apellidoMaterno || ""} ${data?.nombres || ""}`.trim();
      nameField.value = posible || "";
      if (!nameField.value) {
        alert("No se encontró información para ese DNI.");
        return;
      }
    }

    // Memoriza para autocompletar la próxima vez
    if (nameField.value) {
      PEOPLE[dni] = nameField.value.trim();
      saveJSON(LS.peopleKey, PEOPLE);
    }

  } catch (err) {
    console.error(err);
    alert("No fue posible contactar al backend. Verifica la URL configurada en API_BASE.");
  }
});



/* ========= Lógica de formulario (monto, comisión editable, total) ========= */
const amount = q('#amount');
const fee    = q('#fee');
const total  = q('#total');

// Flag: ¿el usuario tocó la comisión manualmente?
let feeManual = false;

// Calculadora automática: S/ 1 por cada S/ 100 (redondeando hacia arriba)
function autoFee(m) {
  const n = Number(m) || 0;
  return n > 0 ? Math.ceil(n / 100) : 0;
}

// Recalcula el total con los valores actuales
function updateTotal() {
  const m = Number(amount.value || 0);
  const f = Number(fee.value || 0);
  total.value = (m + f).toFixed(0);
}

// Al cambiar el monto: si la comisión NO es manual, se recalcula automáticamente
amount.addEventListener('input', () => {
  const m = Number(amount.value || 0);
  if (!feeManual) {
    fee.value = autoFee(m).toFixed(2); // 2 decimales por si aplicas descuentos con céntimos
  }
  updateTotal();
});

// Si el usuario escribe en comisión, marcamos modo manual y actualizamos total
fee.addEventListener('input', () => {
  feeManual = true;
  fee.classList.add('is-manual'); // (opcional, si agregaste CSS)
  updateTotal();
});

// Si el usuario deja comisión vacía y sale del campo, volvemos a modo automático
fee.addEventListener('blur', () => {
  if ((fee.value ?? '').trim() === '') {
    feeManual = false;
    fee.classList.remove('is-manual');
    fee.value = autoFee(Number(amount.value || 0)).toFixed(2);
    updateTotal();
  }
});

// Función para inicializar / reutilizar tras limpiar
function computeTotals(){
  const m = Number(amount.value || 0);
  if (!feeManual) {
    fee.value = autoFee(m).toFixed(2);
  }
  updateTotal();
}

/* Descripciones por banco (datalist) */
q('#bank').addEventListener('change', refreshDescDatalist);
q('#description').addEventListener('input', ()=>{ /* opcional */ });

function refreshDescDatalist(){
  const bank = q('#bank').value || '';
  const list = q('#descList');
  list.innerHTML = '';
  if (!bank) return;
  const options = loadJSON(LS.descKey(bank), []);
  options.slice(0,50).forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v;
    list.appendChild(opt);
  });
}


async function sendReceiptToOdoo(rec) {
  try {
    const res = await fetch('/agente_multibanco/api/receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // IMPORTANTE: Odoo espera JSON en el body
      body: JSON.stringify(rec),
      credentials: 'include' // usa la sesión del usuario logueado en Odoo
    });

    if (!res.ok) {
      console.error('Error desde Odoo:', res.status, await res.text());
      return;
    }

    const data = await res.json();
    console.log('Recibo guardado en Odoo:', data);

  } catch (err) {
    console.error('No se pudo enviar el recibo a Odoo:', err);
  }
}



/* Guardar movimiento + PDF */
q('#btnSave').addEventListener('click', async () => {
  const bank   = q('#bank').value.trim();
  const oper   = q('#agOperator').value.trim();
  const mov    = q('#movement').value.trim();
  const date   = q('#opDate').value || new Date().toISOString().slice(0,10);

  const dniSol  = q('#dniSolicitante').value.trim();
  const nomSol  = q('#nomSolicitante').value.trim();
  const dniBen  = q('#dniBeneficiario').value.trim();
  const nomBen  = q('#nomBeneficiario').value.trim();

  const account = q('#account').value.trim();
  const desc    = q('#description').value.trim();

  const m = Number(amount.value || 0);
  const f = Number(fee.value || 0);
  const t = Number(total.value || 0);

  if (!bank || !oper || !mov) return alert('Completa Banco/Red, Operador y Tipo de movimiento.');
  if (m <= 0) return alert('El monto debe ser mayor a 0.');

  // aprender nombres por DNI
  if (dniSol && nomSol) PEOPLE[dniSol] = nomSol;
  if (dniBen && nomBen) PEOPLE[dniBen] = nomBen;
  saveJSON(LS.peopleKey, PEOPLE);

  // aprender descripciones por banco
  if (desc){
    const key = LS.descKey(bank);
    const arr = loadJSON(key, []);
    if (!arr.includes(desc)) { arr.unshift(desc); saveJSON(key, arr.slice(0,100)); }
  }

  const rec = {
    id: crypto.randomUUID(),
    date, bank, operator: oper, movement: mov,
    solicitante : { dni: dniSol, nombre: nomSol },
    beneficiario: { dni: dniBen, nombre: nomBen },
    account, description: desc,
    amount: m, fee: f, total: t,
    cancelled: false,
    createdAt: Date.now()
  };

  // 1) Guardar en localStorage (como hasta ahora)
  const all = loadJSON(LS.receiptsKey, []);
  all.unshift(rec);
  saveJSON(LS.receiptsKey, all);

  // 2) Enviar a Odoo (nuevo)
  await sendReceiptToOdoo(rec);

  // 3) Generar PDF y limpiar
  generatePDF(rec);
  q('#btnClear').click();
  alert('Movimiento guardado, boleta generada y registrada en Odoo.');
});


q('#btnClear').addEventListener('click', ()=>{
  qa('#agentView input').forEach(i=>{
    if (['fee','total','opDate','agOperator'].includes(i.id)) return;
    i.value = '';
  });
  // al limpiar volvemos a modo automático
  feeManual = false;
  fee.classList.remove('is-manual');
  computeTotals();
  q('#opDate').value = new Date().toISOString().slice(0,10);
});

/* ========= Mis Recibos ========= */
q('#fltDate').addEventListener('change', renderTable);
q('#fltBank').addEventListener('change', renderTable);
q('#btnClearFilters').addEventListener('click', ()=>{
  q('#fltDate').value = '';
  q('#fltBank').value = '';
  renderTable();
});

function buildBankFilterOptions(){
  const sel = q('#fltBank');
  const banks = new Set(loadJSON(LS.receiptsKey, []).map(r=>r.bank));
  const curr = sel.value;
  sel.innerHTML = '<option value="">Todos</option>';
  [...banks].sort().forEach(b=>{
    const opt = document.createElement('option');
    opt.value = b; opt.textContent = b;
    sel.appendChild(opt);
  });
  if ([...banks].includes(curr)) sel.value = curr;
}

function renderTable(){
  const tbody = q('#tblReceipts tbody');
  tbody.innerHTML = '';

  const byDate = q('#fltDate').value;   // YYYY-MM-DD
  const byBank = q('#fltBank').value;

  const all = loadJSON(LS.receiptsKey, []);
  const filtered = all.filter(r=>{
    let ok = true;
    if (byDate) ok = ok && (r.date === byDate);
    if (byBank) ok = ok && (r.bank === byBank);
    return ok;
  });

  let sumFees = 0;

  filtered.forEach(r=>{
    if (!r.cancelled) sumFees += Number(r.fee||0);
    const tr = document.createElement('tr');
    if (r.cancelled) tr.classList.add('row-cancelled');
    tr.innerHTML = `
      <td><span class="badge">${r.bank}</span></td>
      <td>${r.movement}</td>
      <td>${fmtPerson(r.solicitante)}</td>
      <td>${fmtPerson(r.beneficiario)}</td>
      <td>${r.account||''}</td>
      <td>${r.description||''}</td>
      <td class="num">${money(r.amount)}</td>
      <td class="num">${money(r.fee)}</td>
      <td class="num">${money(r.total)}</td>
      <td>${r.date}</td>
      <td><button class="btn" data-act="pdf" data-id="${r.id}">Ver boleta</button></td>
      <td class="rowmenu"><button class="more" data-act="menu" data-id="${r.id}">⋮</button></td>
    `;
    tbody.appendChild(tr);
  });

  // si prefieres entero, vuelve a toFixed(0)
  q('#sumFees').textContent = sumFees.toFixed(2);

  tbody.onclick = (ev)=>{
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'pdf'){
      const r = loadJSON(LS.receiptsKey, []).find(x=>x.id===id);
      if (r) generatePDF(r, true);
    }
    if (btn.dataset.act === 'menu'){
      openRowMenu(btn, id);
    }
  };
}

function openRowMenu(anchorBtn, id) {
  closeMenus();

  const rec = loadJSON(LS.receiptsKey, []).find(x => x.id === id);
  if (!rec) return;

  // Crear el menú (solo con botón de anular/restaurar)
  const menu = document.createElement('div');
  menu.className = 'menu floating';
  menu.innerHTML = `
    <button data-m="toggle">${rec.cancelled ? 'Restaurar' : 'Anular'}</button>
  `;
  document.body.appendChild(menu);

  // Calcular posición del botón en la pantalla
  const rect = anchorBtn.getBoundingClientRect();
  const offsetY = 6;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 180)}px`;
  menu.style.top = `${rect.bottom + offsetY}px`;

  // Acción del botón
  menu.onclick = (e) => {
    const act = e.target.dataset.m;
    if (act !== 'toggle') return;

    const all = loadJSON(LS.receiptsKey, []);
    const i = all.findIndex(x => x.id === id);
    if (i < 0) return;

    // Cambiar el estado de anulado/restaurado
    all[i].cancelled = !all[i].cancelled;
    saveJSON(LS.receiptsKey, all);
    renderTable();
    closeMenus();
  };

  // Cerrar el menú al hacer click fuera, mover o redimensionar
  setTimeout(() => {
    document.addEventListener('click', (ev) => {
      if (!menu.contains(ev.target)) closeMenus();
    }, { once: true });
    window.addEventListener('scroll', closeMenus, { once: true });
    window.addEventListener('resize', closeMenus, { once: true });
  }, 0);
}

function closeMenus() {
  document.querySelectorAll('.menu.floating').forEach(m => m.remove());
}



function fmtPerson(p){ const dni = p?.dni ? ` (${p.dni})` : ''; return `${p?.nombre||'—'}${dni}`; }
function money(n){ return `S/ ${Number(n||0).toFixed(0)}`; }

/* ========= PDF ========= */
function generatePDF(r, openOnly=false){
  const doc = new jsPDF({unit:'pt', format:'a5', orientation:'portrait'});
  const pad = 28;

  // Header
  doc.setFillColor(18, 24, 46);
  doc.roundedRect(pad, pad, doc.internal.pageSize.getWidth()-pad*2, 70, 10, 10, 'F');

  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 224, 255);
  doc.text('AGENTE MULTIBANCO B&L', pad+16, pad+28);

  doc.setFontSize(12);
  doc.setTextColor(255);
  doc.text(`Boleta de ${r.movement.toUpperCase()} — ${r.bank}`, pad+16, pad+50);
  doc.setTextColor(160);
  doc.text(`Fecha: ${r.date}`, pad+16, pad+68);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Av. Principal 123, Puerto Maldonado — RUC 20XXXXXXXXX', pad+16, pad+84);

  // Body
  let y = pad + 120;
  const rows = [
    ['Operador', r.operator || '-'],
    ['Solicitante', `${r.solicitante?.nombre||'-'} (${r.solicitante?.dni||'-'})`],
    ['Beneficiario', `${r.beneficiario?.nombre||'-'} (${r.beneficiario?.dni||'-'})`],
    ['Cuenta / Celular', r.account || '-'],
    ['Descripción', r.description || '-'],
    ['Monto', `S/ ${Number(r.amount||0).toFixed(0)}`],
    ['Comisión', `S/ ${Number(r.fee||0).toFixed(0)}`],
    ['Total', `S/ ${Number(r.total||0).toFixed(0)}`],
    ['Estado', r.cancelled ? 'ANULADA' : 'VÁLIDA']
  ];

  rows.forEach(([k,v])=>{
    doc.setTextColor(110); doc.text(k, pad, y);
    doc.setTextColor(20);  doc.text(String(v), pad+140, y);
    y += 20;
  });

  y += 10;
  doc.setTextColor(120);
  doc.text('Gracias por su preferencia — ¡Vuelva pronto!', pad, y);

  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
}

/* ========= Boot ========= */
(function boot(){
  const current = localStorage.getItem(LS.currentUser);
  if (current) {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    setOperatorFromLogin();
    q('#btnAgent').classList.add('active');
    showAgent();
  }
  // inicializa totales al cargar
  computeTotals();
})();