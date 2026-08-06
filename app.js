const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const products = [
  {id:1,name:'Saha Terps — Collection',category:'resines',price:10,unit:'Sur place',image:'saha_terps.jpeg',desc:'Collection visuelle à personnaliser avec les informations exactes du produit.'},
  {id:2,name:'Sour Runtz',category:'fleurs',price:10,unit:'Sur place',image:'sour_runtz.jpeg',desc:'Fiche produit à compléter avec le format, l’origine et les mentions nécessaires.'},
  {id:3,name:'Frozen Mountain Giants',category:'collections',price:50,unit:'Collection',image:'frozen_mountain.jpeg',desc:'Assortiment premium avec plusieurs références et visuels.'},
  {id:4,name:'Cali Plates — Frozen Sift',category:'resines',price:50,unit:'Collection',image:'cali_plates.jpeg',desc:'Collection Cali Plates à compléter avec les informations réelles.'}
];

const cart = new Map();
const grid = document.querySelector('#productGrid');
const drawer = document.querySelector('#cartDrawer');
const overlay = document.querySelector('#overlay');

const money = v => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(v);

function renderProducts(filter='all'){
  grid.innerHTML='';
  products.filter(p=>filter==='all'||p.category===filter).forEach(p=>{
    const card=document.createElement('article');
    card.className='product';
    card.innerHTML=`<div class="product-visual"><img src="${p.image}" alt="${p.name}"></div>
      <div class="product-body"><span class="badge">${p.unit}</span><h3>${p.name}</h3><p>${p.desc}</p>
      <div class="product-meta"><span class="price">${money(p.price)}</span><small>18+</small></div>
      <button class="btn primary full add" data-id="${p.id}">Ajouter au panier</button></div>`;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.add').forEach(btn=>btn.addEventListener('click',()=>{
    const id=Number(btn.dataset.id);
    cart.set(id,(cart.get(id)||0)+1);
    renderCart(); openCart(); tg?.HapticFeedback?.impactOccurred('light');
  }));
}

function renderCart(){
  const items=document.querySelector('#cartItems');
  items.innerHTML='';
  let total=0,count=0;
  if(!cart.size) items.innerHTML='<p class="muted">Votre panier est vide.</p>';
  cart.forEach((qty,id)=>{
    const p=products.find(x=>x.id===id);
    total+=p.price*qty; count+=qty;
    const row=document.createElement('div');
    row.className='cart-row';
    row.innerHTML=`<div><strong>${p.name}</strong><small>${money(p.price)} × ${qty}</small></div>
      <div class="qty"><button data-action="minus" data-id="${id}">−</button><span>${qty}</span><button data-action="plus" data-id="${id}">+</button></div>`;
    items.appendChild(row);
  });
  document.querySelector('#cartTotal').textContent=money(total);
  document.querySelector('#cartCount').textContent=count;
  items.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const id=Number(btn.dataset.id);
    const next=(cart.get(id)||0)+(btn.dataset.action==='plus'?1:-1);
    next<=0?cart.delete(id):cart.set(id,next);
    renderCart();
  }));
}

function openCart(){drawer.classList.add('open');overlay.classList.add('show');drawer.setAttribute('aria-hidden','false')}
function closeCart(){drawer.classList.remove('open');overlay.classList.remove('show');drawer.setAttribute('aria-hidden','true')}

function buildOrder(){
  if(!cart.size) throw new Error('Ajoutez au moins un produit.');
  const name=document.querySelector('#customerName').value.trim();
  const phone=document.querySelector('#customerPhone').value.trim();
  const address=document.querySelector('#customerAddress').value.trim();
  if(!name||!phone||!address) throw new Error('Complétez le nom, le téléphone et le lieu.');
  let total=0; const lines=[];
  cart.forEach((qty,id)=>{const p=products.find(x=>x.id===id);total+=p.price*qty;lines.push(`• ${p.name} × ${qty} — ${money(p.price*qty)}`)});
  return {name,phone,address,mode:document.querySelector('#deliveryMode').value,note:document.querySelector('#customerNote').value.trim(),total,items:lines};
}

document.querySelector('#orderBtn').addEventListener('click',()=>{
  const status=document.querySelector('#orderStatus');
  try{
    const order=buildOrder();
    const text=`Nouvelle demande CIO Annemasse\n\n${order.items.join('\n')}\n\nTotal indicatif: ${money(order.total)}\nMode: ${order.mode}\nClient: ${order.name}\nTéléphone: ${order.phone}\nAdresse/lieu: ${order.address}\nCommentaire: ${order.note||'—'}`;
    if(tg?.sendData){tg.sendData(JSON.stringify({...order,text}));status.textContent='Demande transmise au bot Telegram.'}
    else{status.textContent='Mode démo : ouvrez cette page depuis votre bot Telegram.';console.log(text)}
  }catch(e){status.textContent=e.message}
});

document.querySelector('#ageYes').addEventListener('click',()=>document.querySelector('#ageGate').classList.add('hidden'));
document.querySelector('#ageNo').addEventListener('click',()=>document.querySelector('.gate-card').innerHTML='<h1>Accès refusé</h1><p>Cette boutique est réservée aux personnes majeures.</p>');
document.querySelector('#cartToggle').addEventListener('click',openCart);
document.querySelector('#cartClose').addEventListener('click',closeCart);
overlay.addEventListener('click',closeCart);
document.querySelector('#categoryFilter').addEventListener('change',e=>renderProducts(e.target.value));
document.querySelector('#contactBtn').addEventListener('click',()=>{tg?.openTelegramLink?.('https://t.me/VOTRE_COMPTE_TELEGRAM')||alert('Remplacez VOTRE_COMPTE_TELEGRAM dans app.js.')});

renderProducts(); renderCart();
