/* script.js
   - password scoring & UI integration
   - dynamic suggestions that mark off as user meets them
   - show/hide eye button
   - "Congratulations" displayed when all checks pass
*/

/* ---------- Helpers & scoring (same heuristic as earlier) ---------- */

const COMMON = [
  "123456","123456789","qwerty","password","111111","12345678","abc123",
  "1234567","password1","iloveyou","123123","admin","letmein","welcome",
  "monkey","dragon","sunshine","princess","qwerty123"
];

function containsUpper(s){ return /[A-Z]/.test(s); }
function containsLower(s){ return /[a-z]/.test(s); }
function containsDigit(s){ return /[0-9]/.test(s); }
function containsSpecial(s){ return /[^A-Za-z0-9\s]/.test(s); }
function hasSequentialChars(s, length=4){
  const lower = s.toLowerCase();
  for(let i=0;i+length<=lower.length;i++){
    const seg = lower.slice(i,i+length);
    if(/^\d+$/.test(seg)){
      let asc = true;
      for(let j=1;j<seg.length;j++) if(+seg[j] !== +seg[j-1]+1) asc=false;
      if(asc) return true;
    }
    if(/^[a-z]+$/.test(seg)){
      let asc = true;
      for(let j=1;j<seg.length;j++) if(seg.charCodeAt(j) !== seg.charCodeAt(j-1)+1) asc=false;
      if(asc) return true;
    }
  }
  return false;
}
function hasRepeatingChars(s,maxRepeat=4){
  const re = new RegExp('(.)\\1{' + (maxRepeat-1) + ',}');
  return re.test(s);
}
function estimateEntropyBits(password){
  let charset = 0;
  if (/[a-z]/.test(password)) charset += 26;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/[0-9]/.test(password)) charset += 10;
  if (/[^A-Za-z0-9]/.test(password)) charset += 32;
  if (charset === 0) return 0;
  const bits = password.length * Math.log2(charset);
  return Math.round(bits);
}

function evaluatePassword(password){
  if(!password) return {score:0, level:"—", details:{}};
  let score = 0;
  const details = {};

  // length
  details.length = password.length >= 8;
  details.lengthBonus = password.length > 12;
  if(details.length) score += 18;
  if(details.lengthBonus) score += 12;

  // variety
  details.upper = containsUpper(password);
  details.lower = containsLower(password);
  details.number = containsDigit(password);
  details.special = containsSpecial(password);
  if(details.upper) score += 10;
  if(details.lower) score += 10;
  if(details.number) score += 15;
  if(details.special) score += 15;

  // entropy
  const bits = estimateEntropyBits(password);
  details.entropyBits = bits;
  const entropyScore = Math.min(15, Math.round((bits / 60) * 15));
  details.entropyScore = entropyScore;
  score += entropyScore;

  // penalties
  let penalties = 0;
  const pwLower = password.toLowerCase().trim();
  details.commonPassword = null;
  for(const c of COMMON){
    if(pwLower === c || pwLower.includes(c) || c.includes(pwLower)){
      penalties += 40;
      details.commonPassword = c;
      break;
    }
  }
  details.sequential = hasSequentialChars(password,4);
  if(details.sequential) penalties += 15;
  details.repeating = hasRepeatingChars(password,4);
  if(details.repeating) penalties += 12;
  details.keyboardPattern = /qwerty|asdf|zxcv/.test(pwLower);
  if(details.keyboardPattern) penalties += 12;

  details.penalties = penalties;
  score -= penalties;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let level = "Weak";
  if(score < 40) level = "Weak";
  else if(score < 60) level = "Medium";
  else if(score < 80) level = "Strong";
  else level = "Very Strong";

  return {score, level, details};
}

/* ---------- UI wiring ---------- */

const passwordInput = document.getElementById('passwordInput');
const strengthFill = document.getElementById('strengthFill');
const entropyText = document.getElementById("entropyText");
const strengthText = document.getElementById('strengthText');
const suggestionsList = document.getElementById('suggestions');
const toggleEye = document.getElementById('toggleEye');
const generateBtn = document.getElementById('generateBtn');
const checkPwnedBtn = document.getElementById('checkPwned');
const pwnedResult = document.getElementById('pwnedResult');

/* Criteria list used to build suggestion UI and check status */
const criteria = [
  { id: 'len8', label: 'At least 8 characters', test: d => !!d.length },
  { id: 'len12', label: 'Longer than 12 characters (recommended)', test: d => !!d.lengthBonus },
  { id: 'lower', label: 'Lowercase letters (a–z)', test: d => !!d.lower },
  { id: 'upper', label: 'Uppercase letters (A–Z)', test: d => !!d.upper },
  { id: 'number', label: 'Numbers (0–9)', test: d => !!d.number },
  { id: 'special', label: 'Special characters (!@#$...)', test: d => !!d.special },
  { id: 'no-seq', label: 'Avoid obvious sequences (1234, abcd)', test: d => !d.sequential },
  { id: 'no-repeat', label: 'Avoid repeated characters (aaaa, 1111)', test: d => !d.repeating },
  { id: 'not-common', label: 'Not a known common password', test: d => !d.commonPassword }
];

function renderSuggestions(details, password){
  // if password empty show placeholder
  if(!password){
    suggestionsList.innerHTML = `<li class="placeholder">Type a password to see dynamic suggestions...</li>`;
    return;
  }

  // build list with met / notmet classes
  let unmet = 0;
  suggestionsList.innerHTML = '';
  criteria.forEach(c => {
    const ok = c.test(details);
    if(!ok) unmet++;
    const li = document.createElement('li');
    li.className = ok ? 'met' : 'notmet';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = ok ? '✓' : '✕';
    li.appendChild(dot);

    const text = document.createElement('span');
    // special case: if common password detected show the offending password
    if(c.id === 'not-common' && details.commonPassword){
      text.textContent = `Avoid common passwords (e.g. "${details.commonPassword}")`;
    } else {
      text.textContent = c.label;
    }
    li.appendChild(text);
    suggestionsList.appendChild(li);
  });

  // if all satisfied -> congratulations
  if(unmet === 0){
    suggestionsList.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'met';
    li.style.justifyContent = 'center';
    li.textContent = '🎉 Congratulations — your password meets all recommendations. Consider using a password manager to store it safely.';
    suggestionsList.appendChild(li);
  }
}

function updateUI(){
  const pw = passwordInput.value;
  const res = evaluatePassword(pw);

  // strength fill width + color
  strengthFill.style.width = res.score + '%';
  // color mapping
  if(res.score < 40){
    strengthFill.style.background = 'linear-gradient(90deg,#ef4444,#f97316)';
    strengthFill.style.boxShadow = '0 6px 20px rgba(239,68,68,0.12)';
  } else if(res.score < 60){
    strengthFill.style.background = 'linear-gradient(90deg,#f59e0b,#f97316)';
    strengthFill.style.boxShadow = '0 6px 20px rgba(245,158,11,0.12)';
  } else if(res.score < 80){
    strengthFill.style.background = 'linear-gradient(90deg,#10b981,#06b6d4)';
    strengthFill.style.boxShadow = '0 6px 20px rgba(16,185,129,0.10)';
  } else {
    strengthFill.style.background = 'linear-gradient(90deg,#06b6d4,#4f46e5)';
    strengthFill.style.boxShadow = '0 6px 24px rgba(6,182,212,0.12)';
  }

  // strength text
  if(!pw){
    strengthText.textContent = 'Enter a password to check strength';
  } else {
    strengthText.textContent = `${res.level} — ${res.score} / 100`;
  }

  // update suggestions (dynamic)
  renderSuggestions(res.details, pw);

  // clear pwned-result when password changes (so user knows result relates to current pw)
  pwnedResult.textContent = '';
}

/* Eye toggle */
toggleEye.addEventListener('click', () => {
  if(passwordInput.type === 'password'){
    passwordInput.type = 'text';
    toggleEye.textContent = '🙈';
    toggleEye.setAttribute('aria-label', 'Hide password');
  } else {
    passwordInput.type = 'password';
    toggleEye.textContent = '👁️';
    toggleEye.setAttribute('aria-label', 'Show password');
  }
});

/* Generate password */
function generatePassword(length = 16){
  const upp = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const low = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*()-_=+[]{};:,.<>/?";
  const all = upp + low + digits + special;
  let p = [];
  // ensure basic variety
  p.push(upp[Math.floor(Math.random()*upp.length)]);
  p.push(low[Math.floor(Math.random()*low.length)]);
  p.push(digits[Math.floor(Math.random()*digits.length)]);
  p.push(special[Math.floor(Math.random()*special.length)]);
  for(let i=4;i<length;i++) p.push(all[Math.floor(Math.random()*all.length)]);
  // shuffle
  for(let i=p.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [p[i],p[j]] = [p[j],p[i]];
  }
  return p.join('');
}
generateBtn.addEventListener('click', () => {
  passwordInput.value = generatePassword(16);
  updateUI();
});

/* Live update on input */
passwordInput.addEventListener('input', updateUI);

/* Initialize */
updateUI();

/* ---------- Optional: HIBP k-anonymity password check (client-side) ---------- */

// SHA-1 helper (Web Crypto) returns uppercase hex
async function sha1Hex(str){
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const h = await crypto.subtle.digest('SHA-1', data);
  const arr = Array.from(new Uint8Array(h));
  return arr.map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
}

async function checkPwned(password){
  pwnedResult.textContent = 'Checking...';
  try{
    const sha1 = await sha1Hex(password);
    const prefix = sha1.slice(0,5);
    const suffix = sha1.slice(5);
    const url = `https://api.pwnedpasswords.com/range/${prefix}`;
    const resp = await fetch(url, { headers: { 'Add-Padding': 'true' } });
    if(!resp.ok){
      pwnedResult.textContent = `HIBP error: ${resp.status}`;
      return;
    }
    const text = await resp.text();
    const lines = text.split('\n');
    for(const line of lines){
      const [hashSuffix, cnt] = line.trim().split(':');
      if(!hashSuffix) continue;
      if(hashSuffix.toUpperCase() === suffix.toUpperCase()){
        const n = parseInt((cnt||'0').trim(), 10) || 0;
        pwnedResult.innerHTML = `<strong style="color:#f59e0b;">Breached</strong> — seen <strong>${n.toLocaleString()}</strong> times. Choose a different password.`;
        return;
      }
    }
    pwnedResult.innerHTML = `<strong style="color:#bff3d6;">Not found</strong> — not present in HIBP dataset.`;
  } catch(err){
    pwnedResult.textContent = 'Error checking breaches';
  }
}

checkPwnedBtn.addEventListener('click', async () => {
  const pw = passwordInput.value;
  if(!pw){ pwnedResult.textContent = 'Type a password first.'; return; }
  await checkPwned(pw);
});
    
