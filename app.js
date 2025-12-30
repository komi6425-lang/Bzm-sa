/* BZM — app.js (Realtime Database version)
   Uses Firebase Realtime Database.
   Admin password injected: zino#mouloud#sofyan#
*/
const ADMIN_EMAIL = "mzi935520@gmail.com";
const ADMIN_PASSWORD = "zino#mouloud#sofyan#";

const firebaseConfig = {
  apiKey: "AIzaSyDs7ChIRz7EqsDUznktbK8UktYltvesExo",
  authDomain: "bzm-app-4bac2.firebaseapp.com",
  projectId: "bzm-app-4bac2",
  storageBucket: "bzm-app-4bac2.firebasestorage.app",
  messagingSenderId: "939539897090",
  appId: "1:939539897090:web:6308a448ca735a91e7801b",
  databaseURL: "https://bzm-ts-default-rtdb.firebaseio.com/"
};

// utilities
function sanitizeEmail(e){ return (e||'').trim().toLowerCase().replace(/\./g,'_'); } // replace dots for keys
function rawEmailFromKey(k){ return (k||'').replace(/_/g,'.'); }
function setCurrentEmail(e){ if(e) localStorage.setItem('bzm_current', e); else localStorage.removeItem('bzm_current'); }
function currentEmail(){ return localStorage.getItem('bzm_current'); }
function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); const el=document.getElementById(id); if(el) el.classList.remove('hidden'); }

// init firebase (assumes compat scripts loaded in index.html)
if(window.firebase && !firebase.apps.length){
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// translations (kept minimal)
const TRANSLATIONS = { en:{ login:"Login", createAccount:"Create Account (Buy card)", chooseCard:"Choose card type", simulatePay:"Create Request", userDashboard:"User Dashboard", yourCards:"Your Cards", requestBonus:"Request Bonus", logout:"Logout", adminPanel:"Admin Panel", prices:"Prices", bonuses:"Bonuses (amount)", paypal:"PayPal", saveSettings:"Save Settings", createFree:"Create Free User & Grant N Cards", generate:"Generate Codes", pending:"Pending Bonus Requests", usersCodes:"Users & Codes", footer:"© BZM", fullName:"Full Name", email:"Email", passwordPH:"Password", referral:"Referral Code (required to buy)", yourPrice:"Your price", yourBonus:"Your bonus" } };
let CURRENT_LANG = 'en';
function applyTranslations(){ const t = TRANSLATIONS[CURRENT_LANG]||TRANSLATIONS.en; if(document.getElementById('txt-login')) document.getElementById('txt-login').innerText=t.login; if(document.getElementById('pay-btn')) document.getElementById('pay-btn').innerText=t.simulatePay; if(document.getElementById('txt-footer')) document.getElementById('txt-footer').innerText=t.footer; if(document.getElementById('reg-name')) document.getElementById('reg-name').placeholder=t.fullName; if(document.getElementById('reg-email')) document.getElementById('reg-email').placeholder=t.email; if(document.getElementById('reg-pass')) document.getElementById('reg-pass').placeholder=t.passwordPH; if(document.getElementById('reg-ref')) document.getElementById('reg-ref').placeholder=t.referral; if(CURRENT_LANG==='ar') document.documentElement.dir='ltr'; else document.documentElement.dir='ltr'; }

// ensure defaults
async function ensureDefaultsRealtime(){
  const ref = db.ref('settings/main');

const snap = await ref.once('value');
  if(!snap.exists()){
    await ref.set({
      prices: { diamond:200, gold:100, silver:50 },
      bonuses: { diamond:600, gold:300, silver:150 },
      paypal: '',
      paypal_urls: { diamond:'', gold:'', silver:'' },
      admin: { email: ADMIN_EMAIL, pass: ADMIN_PASSWORD }
    });
  } else {
    const data = snap.val();
    if(!data.admin){
      await ref.update({ admin: { email: ADMIN_EMAIL, pass: ADMIN_PASSWORD } });
    }
  }
  // seed user
  const usersSnap = await db.ref('users').limitToFirst(1).once('value');
  if(!usersSnap.exists()){
    const key = sanitizeEmail('seed@bzm.local');
    await db.ref('users/'+key).set({
      name:'seed', email:'seed@bzm.local', pass:'seed', cardType:'gold',
      cards:['GOLD-SEED-1','GOLD-SEED-2','GOLD-SEED-3'],
      referrals:0, Ref:'SEED'+Math.random().toString(36).slice(2,6).toUpperCase(), withdrawRequested:false
    });
  }
}

// Realtime listeners
db.ref('settings/main').on('value', (snap)=>{
  const s = snap.val()||{};
  // update select
  const sel = document.getElementById('selected-card');
  if(sel){
    const p = (s.prices) ? s.prices : { diamond:200, gold:100, silver:50 };
    sel.innerHTML = `<option value="">Select Card</option>
      <option value="diamond">Diamond — $${p.diamond}</option>
      <option value="gold">Gold — $${p.gold}</option>
      <option value="silver">Silver — $${p.silver}</option>`;
  }
  // if user logged, refresh view
  if(currentEmail()) loadUser();
});

// helpers for users
async function getUserObjByEmailRaw(email){
  const key = sanitizeEmail(email);
  const snap = await db.ref('users/'+key).once('value');
  return snap.exists()? snap.val() : null;
}
async function saveUserObj(user){
  const key = sanitizeEmail(user.email);
  await db.ref('users/'+key).set(user);
}

// generate cards
function generateCards(count,type){ const arr=[]; for(let i=0;i<count;i++) arr.push(`${type.toUpperCase()}-${Math.random().toString(36).slice(2,9).toUpperCase()}`); return arr; }

/* PayPal: original behavior (opens admin-defined link) */
async function registerOpenPay(){
  const name = (document.getElementById('reg-name').value||'').trim();
  const email = (document.getElementById('reg-email').value||'').trim();
  const pass = (document.getElementById('reg-pass').value||'').trim();
  const ref  = (document.getElementById('reg-ref').value||'').trim();
  const card = document.getElementById('selected-card').value;
  const redotpayId = (document.getElementById('reg-redotpay').value || '').trim();
  if(!name||!email||!pass||!card) return alert('Fill all fields');
  if(!redotpayId) return alert('You must enter RedotPay ID');
  if(!document.getElementById('terms-checkbox').checked) return alert('You must agree to the terms before continuing');
  if(!ref) return alert('You must enter a referral code to buy');
  const q = await db.ref('users').orderByChild('Ref').equalTo(ref).once('value');
  if(!q.exists()) return alert('Referral code is invalid');
  // enforce referral card‑type compatibility
  const refUser = Object.values(q.val())[0];
  if(refUser && refUser.cardType && refUser.cardType !== card){
    return alert('Referral code must match the same card type');
  }
  
  // ===== Prevent duplicate RedotPay ID =====
  const existingRedot = await db.ref('users')
    .orderByChild('redotpayId')
    .equalTo(redotpayId)
    .once('value');
  if (existingRedot.exists()) {
    return alert('This RedotPay ID is already used — it cannot be duplicated');
  }
  const pendingRedot = await db.ref('orders')
    .orderByChild('redotpayId')
    .equalTo(redotpayId)
    .once('value');
  if (pendingRedot.exists()) {
    return alert('There is already a request with this RedotPay ID — wait for review or use another ID');
  }
  
// ===== BLOCK if email already exists or has pending order =====
const existingUser = await getUserObjByEmailRaw(email);
if (existingUser) {
  alert('This email is already used — you cannot create a new request with this email');
  return;
}
const pendingSameEmail = await db.ref('orders')
  .orderByChild('email')
  .equalTo(email)
  .once('value');
if (pendingSameEmail.exists()) {
  alert('There is a pending request with this email — wait for a decision before sending another request');
  return;
}
// =============================================================

  // =========================================

  const orderKey = db.ref('orders').push().key;
  const order = { id: orderKey, name, email, pass, cardType: card, ref, redotpayId, status:'pending', created: Date.now() };
  await db.ref('orders/'+orderKey).set(order);
  alert('The request has been sent to the admin. It will be approved or rejected.');
}

// UI and admin functions
async function loadAdmin(){
  const snap = await db.ref('settings/main').once('value');
  const s = snap.val() || {};
  document.getElementById('price-diamond').value = s.prices? s.prices.diamond : 200;
  document.getElementById('price-gold').value   = s.prices? s.prices.gold : 100;
  document.getElementById('price-silver').value = s.prices? s.prices.silver : 50;
  document.getElementById('bonus-diamond').value = s.bonuses? s.bonuses.diamond : 600;
  document.getElementById('bonus-gold').value   = s.bonuses? s.bonuses.gold : 300;
  document.getElementById('bonus-silver').value = s.bonuses? s.bonuses.silver : 150;
  document.getElementById('paypal-client').value = s.paypal || '';
  document.getElementById('paypal-silver-url').value = (s.paypal_urls && s.paypal_urls.silver)? s.paypal_urls.silver : '';
  document.getElementById('paypal-gold-url').value = (s.paypal_urls && s.paypal_urls.gold)? s.paypal_urls.gold : '';
  document.getElementById('paypal-diamond-url').value = (s.paypal_urls && s.paypal_urls.diamond)? s.paypal_urls.diamond : '';
  await renderBonusRequests(); await renderUsersCodes(); await renderOrders();
}

document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'save-admin'){
    (async ()=>{
      try{
        const sSnap = await db.ref('settings/main').once('value'); const s = sSnap.val() || {};
        s.prices = s.prices || {};
        s.prices.diamond = Number(document.getElementById('price-diamond').value) || s.prices.diamond;
        s.prices.gold = Number(document.getElementById('price-gold').value) || s.prices.gold;
        s.prices.silver = Number(document.getElementById('price-silver').value) || s.prices.silver;
        s.bonuses = s.bonuses || {};
        s.bonuses.diamond = Number(document.getElementById('bonus-diamond').value) || s.bonuses.diamond;
        s.bonuses.gold = Number(document.getElementById('bonus-gold').value) || s.bonuses.gold;
        s.bonuses.silver = Number(document.getElementById('bonus-silver').value) || s.bonuses.silver;
        s.paypal = document.getElementById('paypal-client').value || s.paypal || '';
        s.paypal_urls = s.paypal_urls || {};
        s.paypal_urls.silver = document.getElementById('paypal-silver-url').value || s.paypal_urls.silver || '';
        s.paypal_urls.gold = document.getElementById('paypal-gold-url').value || s.paypal_urls.gold || '';
        s.paypal_urls.diamond = document.getElementById('paypal-diamond-url').value || s.paypal_urls.diamond || '';
        await db.ref('settings/main').set(s);
        alert('Settings saved ✅');
      }catch(err){ console.error(err); alert('Error saving settings: '+err); }
    })();
  }
});

// admin create free user
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'admin-create-free'){
    (async ()=>{
      try{
        const name = document.getElementById('admin-free-name').value.trim();
        const email = (document.getElementById('admin-free-email').value||'').trim();
        const pass = document.getElementById('admin-free-pass').value.trim() || Math.random().toString(36).slice(2,8);
        const cardType = document.getElementById('admin-free-card').value;
        const count = Number(document.getElementById('admin-free-count').value) || 5;
        if(!name||!email) return alert('Enter name and email');
        const existing = await getUserObjByEmailRaw(email);
        if(existing) return alert('Email already exists');
        const cards = generateCards(count, cardType);
        await saveUserObj({ name, email, pass, cardType, cards, referrals:0, Ref: Math.random().toString(36).slice(2,10).toUpperCase(), withdrawRequested:false });
        alert(`Created: ${email} — ${count} ${cardType}`);
        document.getElementById('admin-free-name').value=''; document.getElementById('admin-free-email').value=''; document.getElementById('admin-free-pass').value=''; document.getElementById('admin-free-count').value='5';
        await renderBonusRequests(); await renderUsersCodes(); await renderOrders();
      }catch(err){ console.error(err); alert('Error creating free user: '+err); }
    })();
  }
});

// generate codes
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'gen-btn'){
    (async ()=>{
      try{
        const email = (document.getElementById('gen-email').value||'').trim();
        const type = document.getElementById('gen-type').value;
        const count = Number(document.getElementById('gen-count').value) || 5;
        const u = await getUserObjByEmailRaw(email);
        if(!u) return alert('User not found');
        u.cards = u.cards || [];
        u.cards = u.cards || [];
        u.cards.push(...generateCards(count,type));
        u.referrals = u.referrals || 0; // keep current referrals, do not auto-equal cards
        await saveUserObj(u);
        alert(`${count} cards generated for ${email}`);
        await renderBonusRequests(); await renderUsersCodes(); await renderOrders();
      }catch(err){ console.error(err); alert('Error generating codes: '+err); }
    })();
  }
});

// ----- Orders (Create-account requests) -----
async function renderOrders(){
  const box=document.getElementById('orders-box');
  if(!box) return;
  box.innerHTML='';
  const snap=await db.ref('orders').once('value');
  const orders=snap.exists()?snap.val():{};
  Object.values(orders).filter(o=>o.status==='pending').forEach(o=>{
    const div=document.createElement('div'); div.className='user-block';
    div.innerHTML=`<strong>${o.name}</strong> — ${o.email}<br>Card: ${o.cardType}<br>Ref: ${o.ref}<br>RedotPay: ${o.redotpayId}
    <div class='actions'><button class='ord-approve' data-id='${o.id}'>Approve</button><button class='ord-reject' data-id='${o.id}'>Rejected</button></div>`;
    box.appendChild(div);
  });
  box.querySelectorAll('.ord-approve').forEach(b=>b.addEventListener('click', async ()=>{
    const id=b.getAttribute('data-id');
    const snap=await db.ref('orders/'+id).once('value'); if(!snap.exists()) return;
    const o=snap.val();
    const existing=await getUserObjByEmailRaw(o.email);
    if (existing) {
  // ==== New rule: allow same email ONLY if previous account finished reward ====
  if (!existing.bonusDone) {
    alert('This email already has an active account and has not yet received the reward');
    return;
  }
  // Option 1: delete old account before creating new one
  try {
    await db.ref('users/'+sanitizeEmail(existing.email)).remove();
  } catch(e) { console.error('failed to delete old user', e); }
}
    const cards=generateCards(3,o.cardType);
    await saveUserObj({name:o.name,email:o.email,pass:o.pass,cardType:o.cardType,cards,referrals:0,Ref:Math.random().toString(36).slice(2,10).toUpperCase(),withdrawRequested:false, redotpayId:o.redotpayId});
    
    // ===== REFERRAL++ AFTER APPROVAL (counts only after admin accepts) =====
    try {
      const refCode = o.ref;
      if(refCode){
        const q2 = await db.ref('users').orderByChild('Ref').equalTo(refCode).once('value');
        if(q2.exists()){
          const uid2 = Object.keys(q2.val())[0];
          const refUser2 = Object.values(q2.val())[0];
          const newCount = (refUser2.referrals || 0) + 1;
          await db.ref('users/'+uid2+'/referrals').set(newCount);
        }
      }
    } catch(e){ console.error('referral update after approval failed', e); }
    // ===== END REFERRAL UPDATE =====

    await db.ref('orders/'+id+'/status').set('approved');
    alert('Account created and request approved');
    await renderOrders(); await renderUsersCodes();
  }));
  box.querySelectorAll('.ord-reject').forEach(b=>b.addEventListener('click', async ()=>{
    const id=b.getAttribute('data-id');
    await db.ref('orders/'+id+'/status').set('rejected');
    await renderOrders();
    alert('Request rejected');
  }));
}


// render bonus requests
async function renderBonusRequests(){
  const box = document.getElementById('bonus-requests');
  if(!box) return;
  box.innerHTML = '';
  const usersSnap = await db.ref('users').once('value');
  const users = usersSnap.exists()? usersSnap.val() : {};
  Object.values(users).filter(u=>u.withdrawRequested).forEach(u=>{
    const div = document.createElement('div'); div.className='user-block';
    let codesHtml = '<div class="user-codes">'+((u.cards&&u.cards.length)? u.cards.join('<br>') : '(no codes)') + '</div>';
    div.innerHTML = `<div style="margin-bottom:6px"><strong>${u.name}</strong> — ${u.email}</div><div><strong>PayPal:</strong> ${u.paypalEmail || '—'} — ${u.cardType || 'N/A'}</div> ${codesHtml} <div style="margin-top:8px"> <button class="admin-pay" data-email="${u.email}">Pay Withdrawal</button> <button class="admin-reject" data-email="${u.email}">Reject</button></div>`;
    box.appendChild(div);
  });
  box.querySelectorAll('.admin-pay').forEach(b=>b.addEventListener('click', async ()=>{
    const email = b.getAttribute('data-email'); const u = await getUserObjByEmailRaw(email); if(!u) return;
    u.referrals = 0; u.withdrawRequested = false; await saveUserObj(u); await renderBonusRequests(); await renderUsersCodes(); await renderOrders(); alert('Bonus manually paid.');
  }));
  box.querySelectorAll('.admin-reject').forEach(b=>b.addEventListener('click', async ()=>{ const email=b.getAttribute('data-email'); const u=await getUserObjByEmailRaw(email); if(!u) return; u.withdrawRequested=false; await saveUserObj(u); await renderBonusRequests(); alert('Rejected'); }));
}

// render users & codes
async function renderUsersCodes(){
  const box = document.getElementById('users-codes');
  if(!box) return;
  box.innerHTML = '';
  const usersSnap = await db.ref('users').once('value');
  const users = usersSnap.exists()? usersSnap.val() : {};
  Object.values(users).forEach(u=>{
    const div = document.createElement('div'); div.className='user-block';
    let codesHtml = (u.cards && u.cards.length) ? '<div class="user-codes">'+u.cards.join('<br>')+'</div>' : '<div class="user-codes">(no codes)</div>';
    div.innerHTML = `<strong>${u.name}</strong> — ${u.email}</div><div><strong>PayPal:</strong> ${u.paypalEmail || '—'} <br> Ref: ${u.Ref || '—'}<br> Type: ${u.cardType || '—'} <br> ${codesHtml}`;
    box.appendChild(div);
  });
}

// user view
async function loadUser(){
  const cur = currentEmail();
  const u = cur ? await getUserObjByEmailRaw(cur) : null;
    if(u && u.withdrawStatus === "paid"){
      await showWithdrawalWonScreen(u);
      show('user-screen');
      return;
    }
  if(!u){ show('auth-screen'); return; }
  const sSnap = await db.ref('settings/main').once('value');
  const s = sSnap.val() || {};
  const price = (s.prices && s.prices[u.cardType])? s.prices[u.cardType] : 0;
  const bonus = (s.bonuses && s.bonuses[u.cardType])? s.bonuses[u.cardType] : 0;
  // === Updated balance logic: full balance after 3 referrals ===
  const refs = u.referrals || 0;
  let finalBalance = price;
  let balanceText = `${price}$`;

  if(refs >= 3){
    finalBalance = price + bonus;
    balanceText = `${price}$ + ${bonus}$ = ${finalBalance}$`;
  }
  if(document.getElementById('user-balance'))
    document.getElementById('user-balance').innerText = balanceText;

  const t = TRANSLATIONS[CURRENT_LANG] || TRANSLATIONS.en;
  if(document.getElementById('user-price')) document.getElementById('user-price').innerText = `${t.yourPrice}: ${price}$`;
  if(document.getElementById('user-balance'))
    document.getElementById('user-balance').innerText = `${price}$`;
  if(document.getElementById('user-cardtype'))
    document.getElementById('user-cardtype').innerText = (u.cardType || '').toUpperCase();
  if(document.getElementById('user-bonus')) document.getElementById('user-bonus').innerText = `${t.yourBonus}: ${bonus}$`;
  if(document.getElementById('user-referrals')) document.getElementById('user-referrals').innerText = `Referrals: ${u.referrals || 0} / 3`;
  if(document.getElementById('user-refcode')) document.getElementById('user-refcode').innerText = u.Ref || '—';
  const cardsEl = document.getElementById('user-cards'); if(cardsEl){ cardsEl.innerHTML=''; (u.cards||[]).forEach(c=>{ const d=document.createElement('div'); d.className='card-pill'; d.innerText=c; cardsEl.appendChild(d); }); }
  // copy button
  if(!document.getElementById('copy-ref-btn')){ const cb=document.createElement('button'); cb.id='copy-ref-btn'; cb.className='btn'; cb.style.marginLeft='8px'; cb.style.display='inline-block'; cb.innerText='Copy'; const refEl=document.getElementById('user-refcode'); if(refEl && refEl.parentNode) refEl.parentNode.appendChild(cb); cb.addEventListener('click', ()=>{ navigator.clipboard && navigator.clipboard.writeText(refEl.innerText); alert('Referral code copied'); }); }
  const btn = document.getElementById('request-bonus-btn'); if(btn){ btn.onclick = async ()=>{ let paypalEmail = prompt(TRANSLATIONS[CURRENT_LANG].bonusPrompt); if(!paypalEmail){ alert("You must enter your PayPal email."); return; } u.paypalEmail = paypalEmail; if((u.referrals||0) < 3){ alert('You must have 3 referrals to request the bonus.'); return; } u.withdrawRequested = true; await saveUserObj(u); alert(TRANSLATIONS[CURRENT_LANG].bonusSent); show('user-screen'); }; }
  show('user-screen');
}

// update select pricing
function updateCardPricesInSelect(){ db.ref('settings/main').once('value').then(snap=>{ const s=snap.val()||{}; const p=s.prices||{diamond:200,gold:100,silver:50}; const sel=document.getElementById('selected-card'); if(sel) sel.innerHTML=`<option value="">Select Card</option><option value="diamond">Diamond — $${p.diamond}</option><option value="gold">Gold — $${p.gold}</option><option value="silver">Silver — $${p.silver}</option>`; }).catch(e=>console.error(e)); }

// title admin clicks
let adminClicks=0;
const title=document.getElementById('app-title');
if(title){
  title.addEventListener('click', ()=>{ adminClicks++; clearTimeout(window._bzm_admin_timer); window._bzm_admin_timer=setTimeout(()=>{ adminClicks=Math.max(0,adminClicks-1); },3000); if(adminClicks>=20){ adminClicks=0; (async ()=>{ const pass=prompt('Enter admin password:'); try{ const sSnap = await db.ref('settings/main').once('value'); const adminObj = (sSnap.exists() && sSnap.val().admin) ? sSnap.val().admin : {email:ADMIN_EMAIL, pass:ADMIN_PASSWORD}; if(pass && pass.trim()===adminObj.pass){ await loadAdmin(); show('admin-screen'); } else { alert('Wrong password'); } }catch(e){ if(pass && pass.trim()===ADMIN_PASSWORD){ await loadAdmin(); show('admin-screen'); } else alert('Wrong password'); } })(); } }); }

// logout
document.addEventListener('click',(e)=>{ if(e.target && e.target.id==='logout-btn'){ setCurrentEmail(null); show('auth-screen'); } });

// login & pay handlers
document.addEventListener('click',(e)=>{ if(e.target && e.target.id==='login-btn') loginHandler(); if(e.target && e.target.id==='pay-btn') registerOpenPay(); });

// login function
async function loginHandler(){ const email=(document.getElementById('login-email').value||'').trim(); const pass=(document.getElementById('login-pass').value||''); if(!email||!pass) return alert('Login failed'); const u = await getUserObjByEmailRaw(email); if(!u || u.pass !== pass) return alert('Login failed'); setCurrentEmail(u.email); await loadUser(); }

// boot
async function boot(){ try{ await ensureDefaultsRealtime(); applyTranslations(); updateCardPricesInSelect(); const cur=currentEmail(); if(cur){ const exists=await getUserObjByEmailRaw(cur); if(exists) await loadUser(); else show('auth-screen'); } else show('auth-screen'); }catch(err){ console.error('Boot failed',err); alert('Initialization failed: '+err); } }

boot();


// language selector fix
document.addEventListener('change', (e)=>{
  if(e.target && e.target.id==='lang-select'){
    CURRENT_LANG = e.target.value;
    localStorage.setItem('bzm_lang', CURRENT_LANG);
    applyTranslations();
  }
});

// close admin fix
document.addEventListener('click',(e)=>{
  if(e.target && e.target.id==='admin-logout'){
    show('auth-screen');
  }
});

// ====== Referral Withdrawal (RedotPay) System ======
async function requestRedotPayWithdrawal(){
  const email = currentEmail();
  const u = await getUserObjByEmailRaw(email);
  if(!u) return alert("An error occurred");

  const _rCount = (u.referrals || 0);
if(_rCount < 3)
  return alert("You must reach 3 referrals before requesting the reward");


  if(u.withdrawStatus === "pending")
    return alert("Your request is already under review");

  const redot = prompt("Enter your RedotPay number");
  if(!redot) return;

  // Cards are not deducted after requesting the reward — condition depends only on referrals


  const reqKey = db.ref("withdrawRequests").push().key;
  await db.ref("withdrawRequests/"+reqKey).set({
    id:reqKey,
    email:u.email,
    name:u.name,
    cardType:u.cardType || "",
    referrals:u.referrals || 0,
    redotpay:redot,
    status:"pending",
    created:Date.now()
  });

  await db.ref("users/"+sanitizeEmail(u.email)+"/withdrawStatus").set("pending");

  alert("The request has been sent to the admin for review");
}

async function renderWithdrawalRequests(){
  const box = document.getElementById("reward-requests");
  if(!box) return;
  box.innerHTML="";

  const snap = await db.ref("withdrawRequests").once("value");
  const reqs = snap.exists()? snap.val() : {};

  Object.values(reqs).filter(r=>r.status==="pending").forEach(r=>{
    const div = document.createElement("div");
    div.className="user-block";
    div.innerHTML = `
      <strong>${r.name}</strong> — ${r.email}<br>
      Referrals: ${r.referrals}<br>
      RedotPay: ${r.redotpay}
      <div class="actions">
        <button class="rw-approve" data-id="${r.id}" data-email="${r.email}">Approve</button>
        <button class="rw-reject" data-id="${r.id}" data-email="${r.email}">Rejected</button>
      </div>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll(".rw-approve").forEach(b=>b.onclick = async ()=>{
    const id = b.dataset.id;
    const email = b.dataset.email;
    const key = sanitizeEmail(email);
    await db.ref("withdrawRequests/"+id+"/status").set("approved");
    await db.ref("users/"+key+"/withdrawStatus").set("paid");
    // Reset balance after withdrawal
    await db.ref("users/"+key+"/referrals").set(0);
    await db.ref("users/"+key+"/balanceCleared").set(true);
    // referrals already deducted at request time
    // await db.ref("users/"+key+"/referrals").set(0);
    alert("Withdrawal request approved and paid ✔");
    renderWithdrawalRequests();
  });

  box.querySelectorAll(".rw-reject").forEach(b=>b.onclick = async ()=>{
    const id = b.dataset.id;
    const email = b.dataset.email;
    const key = sanitizeEmail(email);
    await db.ref("withdrawRequests/"+id+"/status").set("rejected");
    await db.ref("users/"+key+"/withdrawStatus").remove();
    alert("❌ Request rejected");
    renderWithdrawalRequests();
  });
}

// hook inside loadAdmin
const _loadAdmin_orig = loadAdmin;
loadAdmin = async function(){
  await _loadAdmin_orig();
  await renderWithdrawalRequests();
};

// show request button when referrals >=5
const _loadUser_orig = loadUser;
loadUser = async function(){
  await _loadUser_orig();
  try{
    const cur = currentEmail();
    const u = cur ? await getUserObjByEmailRaw(cur) : null;
    if(u && (u.referrals||0) >= 3 && !u.withdrawStatus){
  const panel = document.getElementById("user-panel") || document.getElementById("user-screen");
  if(panel && !document.getElementById("ask-redotpay-btn")){
    const btn=document.createElement("button");
    btn.id="ask-redotpay-btn";
    btn.className="btn";
    btn.innerText="Withdraw Balance (after 3 referrals)";
    btn.onclick=requestRedotPayWithdrawal;
    panel.appendChild(btn);
  }
}

  }catch(e){ console.error(e); }

  // enforce rule: each card = one referral
  if(u){
    const synced = await syncReferralsWithCards(u);
    if(document.getElementById('user-referrals'))
      document.getElementById('user-referrals').innerText = `Referrals: ${synced} / 3`;
  }
    };

// --- Soft sync: ensure referrals never exceed number of cards ---
async function syncReferralsWithCards(u){
  try{
    const count = (u.cards && Array.isArray(u.cards)) ? u.cards.length : 0;
    if((u.referrals||0) > count){
      u.referrals = count;
      await saveUserObj(u);
    }
    return u.referrals || 0;
  }catch(e){ console.error("softSyncReferrals failed", e); return (u.referrals||0); }
}
// ====== End Referral Withdrawal System ======



// === Withdrawal Paid — Show Congrats Only ===
async function showWithdrawalWonScreen(u){
  try{
    const sSnap = await db.ref('settings/main').once('value');
    const s = sSnap.val() || {};
    const bonus = (s.bonuses && s.bonuses[u.cardType]) ? s.bonuses[u.cardType] : 0;
    const scr = document.getElementById('user-screen');
    const panel = document.getElementById('user-panel');
    if(scr){
      // hide all children except panel
      Array.from(scr.children).forEach(ch=>{
        if(ch !== panel) ch.classList.add('hidden');
      });
    }
    if(panel){
      panel.innerHTML = `<h2 style="text-align:center;margin-top:10px">🎉 Congratulations, your withdrawal was approved</h2>
      <p style="font-size:20px;text-align:center;margin:14px 0">💰 Withdrawn amount: <strong>${bonus}$</strong></p>`;
    }
    const btn = document.getElementById('request-bonus-btn');
    if(btn) btn.classList.add('hidden');
  }catch(e){ console.error("showWithdrawalWonScreen failed", e); }
}

