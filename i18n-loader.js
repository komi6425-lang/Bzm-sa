
let currentLang = localStorage.getItem("bzm_lang") || "en";
async function loadLang(lang){
  try{
    const res = await fetch(`lang.${lang}.json`);
    const d = await res.json();
    const t = k => k.split('.').reduce((o,i)=>o&&o[i], d) || k;
    document.querySelectorAll("[data-i18n]").forEach(el=> el.textContent = t(el.dataset.i18n));
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el=> el.placeholder = t(el.dataset.i18nPlaceholder));
    const rtl = ["ar","fa","ur","he"];
    document.documentElement.dir = rtl.includes(lang)? "rtl":"ltr";
    localStorage.setItem("bzm_lang", lang);
    currentLang = lang;
  }catch(e){ console.error(e); }
}
function fillLangs(){
 const langs=[["en","English"],["ar","العربية"],["fr","Français"],["es","Español"],["pt","Português"],
 ["pt-BR","Português (Brasil)"],["de","Deutsch"],["it","Italiano"],["tr","Türkçe"],["ru","Русский"],
 ["zh-CN","简体中文"],["zh-TW","繁體中文"],["ja","日本語"],["ko","한국어"],["hi","हिन्दी"],
 ["ur","اردو"],["fa","فارسی"],["id","Bahasa Indonesia"],["ms","Bahasa Melayu"],["bn","বাংলা"],
 ["uk","Українська"],["pl","Polski"],["nl","Nederlands"],["sv","Svenska"],["no","Norsk"],
 ["da","Dansk"],["fi","Suomi"],["cs","Čeština"],["ro","Română"],["bg","Български"],
 ["el","Ελληνικά"],["th","ไทย"],["vi","Tiếng Việt"],["he","עברית"],["sr","Српски"],
 ["hr","Hrvatski"],["sk","Slovenčina"],["hu","Magyar"],["et","Eesti"],["sl","Slovenščina"]];
 const sel=document.getElementById("lang-select"); if(!sel) return;
 sel.innerHTML = langs.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
 sel.value=currentLang; sel.onchange=e=>loadLang(e.target.value);
}
window.addEventListener("DOMContentLoaded", ()=>{ fillLangs(); loadLang(currentLang); });
