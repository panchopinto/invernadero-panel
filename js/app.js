
// Minimal state

const CFG = (window.INVENTARIO_CONFIG)||{categorias:[],umbrales:{_default:5}};

let data = [];
let auto = false;
let lastLoaded = null;

const tabla = document.querySelector("#tabla tbody");
const q = document.querySelector("#q");
const fcat = document.querySelector("#f_categoria");
const fest = document.querySelector("#f_estado");
const fubi = document.querySelector("#f_ubicacion");
const autoSwitch = document.querySelector("#autoSwitch");
const autoLabel = document.querySelector("#autoLabel");
const fileInput = document.querySelector("#fileInput");

function CLP(n){ return n.toLocaleString('es-CL',{style:'currency',currency:'CLP'}); }

function statusBadge(row){
  const s = row.estado?.toUpperCase() || 'OK';
  const map = { 'OK':'s-ok','BAJO':'s-low','AGOTADO':'s-out' };
  return `<span class="status ${map[s]||'s-ok'}">${s}</span>`;
}

function refreshFilters(){
  const catsFromData = [...new Set(data.map(x=>x.categoria).filter(Boolean))];
  const cats = Array.from(new Set([...(CFG.categorias||[]), ...catsFromData])).sort();
  fcat.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c=>`<option>${c}</option>`).join('');

  const ubis = [...new Set(data.map(x=>x.ubicacion).filter(Boolean))].sort();
  fubi.innerHTML = `<option value="">Todas las ubicaciones</option>` + ubis.map(c=>`<option>${c}</option>`).join('');
}

function computeKPIs(rows){
  const totalItems = rows.length;
  const totalUnits = rows.reduce((a,b)=>a + (parseFloat(b.cantidad)||0),0);
  const totalValue = rows.reduce((a,b)=>a + ( (parseFloat(b.cantidad)||0) * (parseFloat(b.valor_unitario)||0) ),0);
  const cats = new Set(rows.map(r=>r.categoria).filter(Boolean)).size;
  document.querySelector('#k_total').textContent = totalItems;
  document.querySelector('#k_units').textContent = totalUnits.toLocaleString('es-CL');
  document.querySelector('#k_cats').textContent = cats;
  document.querySelector('#k_value').textContent = CLP(totalValue);
}

function render(){
  const term = (q.value||'').toLowerCase();
  let rows = data.filter(r=>{
    const hit = [r.codigo,r.nombre,r.proveedor].map(x=>String(x||'').toLowerCase()).some(t=>t.includes(term));
    const catOk = !fcat.value || r.categoria===fcat.value;
    const estOk = !fest.value || (r.estado||'').toUpperCase()===fest.value;
    const ubiOk = !fubi.value || r.ubicacion===fubi.value;
    return hit && catOk && estOk && ubiOk;
  });

  // Recalcular estado según umbrales si no viene definido o está vacío
  rows = rows.map(r=>{
    const qty = parseFloat(r.cantidad)||0;
    const cat = r.categoria||"";
    const minimo = r.minimo ? parseFloat(r.minimo) : (CFG.umbrales[cat] ?? CFG.umbrales._default ?? 5);
    let estado = (r.estado||"").toUpperCase().trim();
    if (!estado) {
      if (qty <= 0) estado = "AGOTADO";
      else if (qty < minimo) estado = "BAJO";
      else estado = "OK";
    }
    r._minimo = minimo;
    r.estado = estado;
    return r;
  });

  computeKPIs(rows);
  tabla.innerHTML = rows.map(r=>{
    const vu = parseFloat(r.valor_unitario)||0;
    const qty = parseFloat(r.cantidad)||0;
    return `<tr>
      <td>${r.codigo||''}</td>
      <td>${r.nombre||''}</td>
      <td>${r.categoria||''}</td>
      <td>${r.unidad||''}</td>
      <td>${qty}</td>
      <td>${r.ubicacion||''}</td>
      <td>${r.proveedor||''}</td>
      <td>${vu?CLP(vu):''}</td>
      <td>${vu?CLP(vu*qty):''}</td>
      <td>${r._minimo??''}</td>
      <td>${statusBadge(r)}</td>
      <td>${r.fecha_ingreso||''}</td>
    </tr>`;
  }).join('');
}

function parseCSV(text){
  const [headLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headLine.split(',').map(h=>h.trim());
  return lines.map(line=>{
    const cells = line.split(',').map(c=>c.trim());
    const row = {};
    headers.forEach((h,i)=> row[h]=cells[i]||'' );
    return row;
  });
}

async function loadCSV(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('No se pudo cargar el CSV');
  const txt = await res.text();
  return parseCSV(txt);
}

function toCSV(rows){
  const headers = ["codigo","nombre","categoria","unidad","cantidad","ubicacion","proveedor","fecha_ingreso","valor_unitario","estado","minimo","observaciones"];
  const lines = [headers.join(",")].concat(rows.map(r=>headers.map(h=>(r[h]??"")).join(",")));
  return lines.join("\n");
}

async function init(){
  try{
    data = await loadCSV("data/inventario.csv");
  }catch(e){
    data = [];
  }
  refreshFilters();
  render();
  lastLoaded = Date.now();
}

init();

// Controls
q.addEventListener('input', render);
fcat.addEventListener('change', render);
fest.addEventListener('change', render);
fubi.addEventListener('change', render);

document.querySelector('#btnExport').addEventListener('click',()=>{
  const csv = toCSV(data);
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "inventario_export.csv";
  a.click();
});

document.querySelector('#btnImport').addEventListener('click',()=> fileInput.click());
fileInput.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  data = parseCSV(text);
  refreshFilters();
  render();
});

document.querySelector('#btnAdd').addEventListener('click',()=>{
  const nombre = prompt("Nombre del ítem:");
  if(!nombre) return;
  const nuevo = {
    codigo: prompt("Código (opcional):")||"",
    nombre,
    categoria: prompt("Categoría (ej. herramientas, riego, semillas):")||"",
    unidad: prompt("Unidad (UN, kg, lt):")||"UN",
    cantidad: prompt("Cantidad:")||"0",
    ubicacion: prompt("Ubicación (Bodega, Invernadero 1, etc.):")||"",
    proveedor: prompt("Proveedor:")||"",
    fecha_ingreso: new Date().toISOString().slice(0,10),
    valor_unitario: prompt("Valor unitario CLP (número):")||"0",
    estado: prompt("Estado (OK/BAJO/AGOTADO):")||"OK",
    observaciones: ""
  };
  data.unshift(nuevo);
  refreshFilters();
  render();
});

// Auto refresh mock (reload local CSV when toggled)
autoSwitch.addEventListener('click',()=>{
  auto = !auto;
  autoSwitch.classList.toggle('on', auto);
  autoLabel.textContent = auto ? "Auto: ON" : "Auto: OFF";
});

document.querySelector('.year').textContent = new Date().getFullYear();
