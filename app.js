document.documentElement.dir="ltr";
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
 

boot();



// close admin fix
document.addEventListener('click',(e)=>{
  if(e.target && e.target.id==='admin-logout'){
    show('auth-screen');
  }
});

// ====== Referral Reward (RedotPay) System ======
async function requestRedotPayReward(){
  const email = currentEmail();
  const u = await getUserObjByEmailRaw(email);
  if(!u) return alert("An error occurred");

  const _rCount = (u.referrals || 0);
if(_rCount < 5)
  return alert("❌ You must reach 5 referrals before requesting the reward");


  if(u.rewardStatus === "pending")
    return alert("⏳ Your request is already under review");

  const redot = prompt("Enter your RedotPay number");
  if(!redot) return;

  // Cards are not deducted after Request Reward — the condition depends only on referrals


  const reqKey = db.ref("rewardRequests").push().key;
  await db.ref("rewardRequests/"+reqKey).set({
    id:reqKey,
    email:u.email,
    name:u.name,
    cardType:u.cardType || "",
    referrals:u.referrals || 0,
    redotpay:redot,
    status:"pending",
    created:Date.now()
  });

  await db.ref("users/"+sanitizeEmail(u.email)+"/rewardStatus").set("pending");

  alert("✔ Your request has been sent to the admin for review");
}

async function renderRewardRequests(){
  const box = document.getElementById("reward-requests");
  if(!box) return;
  box.innerHTML="";

  const snap = await db.ref("rewardRequests").once("value");
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
        <button class="rw-reject" data-id="${r.id}" data-email="${r.email}">Reject</button>
      </div>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll(".rw-approve").forEach(b=>b.onclick = async ()=>{
    const id = b.dataset.id;
    const email = b.dataset.email;
    const key = sanitizeEmail(email);
    await db.ref("rewardRequests/"+id+"/status").set("approved");
    await db.ref("users/"+key+"/rewardStatus").set("paid");
    // referrals already deducted at request time
    // await db.ref("users/"+key+"/referrals").set(0);
    alert("✔ The request has been approved and the reward has been paid");
    renderRewardRequests();
  });

  box.querySelectorAll(".rw-reject").forEach(b=>b.onclick = async ()=>{
    const id = b.dataset.id;
    const email = b.dataset.email;
    const key = sanitizeEmail(email);
    await db.ref("rewardRequests/"+id+"/status").set("rejected");
    await db.ref("users/"+key+"/rewardStatus").remove();
    alert("❌ The request has been rejected");
    renderRewardRequests();
  });
}

// hook inside loadAdmin
const _loadAdmin_orig = loadAdmin;
loadAdmin = async function(){
  await _loadAdmin_orig();
  await renderRewardRequests();
};

// show request button when referrals >=5
const _loadUser_orig = loadUser;
loadUser = async function(){
  await _loadUser_orig();
  try{
    const cur = currentEmail();
    const u = cur ? await getUserObjByEmailRaw(cur) : null;
    if(u && (u.referrals||0) >= 5 && !u.rewardStatus){
  const panel = document.getElementById("user-panel") || document.getElementById("user-screen");
  if(panel && !document.getElementById("ask-redotpay-btn")){
    const btn=document.createElement("button");
    btn.id="ask-redotpay-btn";
    btn.className="btn";
    btn.innerText="Request Reward (after 5 referrals)";
    btn.onclick=requestRedotPayReward;
    panel.appendChild(btn);
  }
}

  }catch(e){ console.error(e); }

  // enforce rule: each card = one referral
  if(u){
    const synced = await syncReferralsWithCards(u);
    if(document.getElementById('user-referrals'))
      document.getElementById('user-referrals').innerText = `Referrals: ${synced} / 5`;
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
// ====== End Referral Reward System ======



// === Reward Paid — Show Congrats Only ===
async function showRewardWonScreen(u){
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
      panel.innerHTML = `<h2 style="text-align:center;margin-top:10px">🎉 Congratulations — you won the reward</h2>
      <p style="font-size:20px;text-align:center;margin:14px 0">💰 Amount: <strong>${bonus}$</strong></p>`;
    }
    const btn = document.getElementById('request-bonus-btn');
    if(btn) btn.classList.add('hidden');
  }catch(e){ console.error("showRewardWonScreen failed", e); }
}


async function boot(){
  try{
    if (typeof updateCardPricesInSelect === "function") {
      updateCardPricesInSelect();
    }
    const cur = typeof currentEmail === "function" ? currentEmail() : null;
    if(cur){
      const exists = typeof getUserObjByEmailRaw === "function" ? await getUserObjByEmailRaw(cur) : null;
      if(exists){
        if (typeof loadUser === "function") await loadUser();
        else if (typeof show === "function") show("user-screen");
      } else {
        if (typeof show === "function") show("auth-screen");
      }
    }else{
      if (typeof show === "function") show("auth-screen");
    }
  }catch(err){
    console.error("Boot failed", err);
    try{ alert("Initialization failed: " + err); }catch(e){}
  }
}
boot();

