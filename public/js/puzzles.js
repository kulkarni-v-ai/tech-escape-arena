/* ===========================
   Tech Escape Arena – Dynamic Puzzles
   =========================== */

const TECH_WORDS = [
  "SYSTEM","NEXUS","ROUTER","SERVER","MATRIX","PORTAL","ACCESS","ENCODER",
  "CYBER","KERNEL","DOMAIN","NODE","PACKET","CIPHER","PROXY", "HACKER",
  "CLIENT","SOCKET","GIGABIT","BINARY","BOTNET","UPLINK","TROJAN","CACHE",
  "DONKEY","FIREWALL","MALWARE","SUBNET","SWITCH","VECTOR","WIDGET",
  "ZELDA","APOLLO","GALAXY","ORACLE","PHANTOM","QUANTUM","RADAR","TITAN","VIRUS"
];

const RIDDLES = [
  { q: "I have cities but no houses. Mountains but no trees. Water but no fish.", a: "MAP" },
  { q: "I speak without a mouth and hear without ears. I come alive with wind.", a: "ECHO" },
  { q: "I run, but I have no legs. I am sometimes called a bed but I do not sleep.", a: "RIVER" },
  { q: "I have keys but open no locks. I have space but no room.", a: "KEYBOARD" },
  { q: "I go up and down but never move.", a: "STAIRS" },
  { q: "I can fill a room but take up no space.", a: "LIGHT" },
  { q: "Drop me from the highest building and I'll survive, but drop me in water and I die.", a: "PAPER" },
  { q: "I have branches, but no fruit, trunk or leaves.", a: "BANK" },
  { q: "I belong to you, but everyone else uses me more.", a: "NAME" },
  { q: "I have an eye but cannot see.", a: "NEEDLE" },
  { q: "I break the moment you name me.", a: "SILENCE" },
  { q: "I get wetter the more I dry.", a: "TOWEL" },
  { q: "I am full of holes but still hold water.", a: "SPONGE" },
  { q: "You hold my tail while I fish for you.", a: "NET" },
  { q: "The more of this there is, the less you see.", a: "DARKNESS" },
  { q: "I have a head and a tail that will never meet. Having too many of me is always a treat.", a: "COIN" },
  { q: "What has many teeth, but cannot bite?", a: "COMB" },
  { q: "I'm tall when I'm young, and I'm short when I'm old.", a: "CANDLE" },
  { q: "What has a thumb and four fingers, but is not a hand?", a: "GLOVE" },
  { q: "What can you catch, but not throw?", a: "COLD" },
  { q: "What has words, but never speaks?", a: "BOOK" },
  { q: "What runs all around a backyard, yet never moves?", a: "FENCE" },
  { q: "What is always in front of you but can't be seen?", a: "FUTURE" },
  { q: "What can you break, even if you never pick it up or touch it?", a: "PROMISE" },
  { q: "I shave every day, but my beard stays the same.", a: "BARBER" },
  { q: "I have hands, but I cannot clap.", a: "CLOCK" },
  { q: "It belongs to you, but other people use it more than you do.", a: "NAME" },
  { q: "What has to be broken before you can use it?", a: "EGG" },
  { q: "I have a neck but no head.", a: "BOTTLE" },
  { q: "I have 13 hearts, but no other organs.", a: "CARDS" },
  { q: "If you've got me, you want to share me; if you share me, you haven't kept me.", a: "SECRET" },
  { q: "What falls, but never breaks? What breaks, but never falls?", a: "NIGHT AND DAY" },
  { q: "What is harder to catch the faster you run?", a: "BREATH" },
  { q: "I fly without wings. I cry without eyes. Wherever I go, darkness follows me.", a: "CLOUD" },
  { q: "If you build a fort, drive a Ford, and fill out a form, what do you eat soup with?", a: "SPOON" },
  { q: "What goes through cities and fields, but never moves?", a: "ROAD" },
  { q: "I have lakes with no water, mountains with no stone and cities with no buildings.", a: "MAP" },
  { q: "I possess a halo of water, walls of stone, and a tongue of wood.", a: "CASTLE" },
  { q: "I'm light as a feather, yet the strongest person can't hold me for five minutes.", a: "BREATH" },
  { q: "I'm not alive, but I can grow; I don't have lungs, but I need air.", a: "FIRE" }
];

function getPuzzlesForTeam(teamId) {
  // Simple deterministic hash
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = ((hash << 5) - hash) + teamId.charCodeAt(i);
    hash |= 0; 
  }
  hash = Math.abs(hash);
  
  const idx = hash % 40;
  
  // =========================================
  // PUZZLE 1: Multi-Layer Cipher (COMPLEX)
  // Steps: Caesar shift → Reverse → Pair-Swap
  // =========================================
  const shift = (hash % 5) + 2; // Shift between 2 and 6
  const word1 = TECH_WORDS[idx];
  
  // Encryption process (what we show the user):
  // 1. Caesar shift each letter FORWARD by 'shift'
  // 2. Reverse the string
  // 3. Swap adjacent pairs (AB → BA)
  
  // Step 1: Caesar shift forward
  let step1 = word1.split('').map(c => {
    let code = c.charCodeAt(0) + shift;
    if (code > 90) code -= 26;
    return String.fromCharCode(code);
  }).join('');
  
  // Step 2: Reverse
  let step2 = step1.split('').reverse().join('');
  
  // Step 3: Swap adjacent pairs
  let step3chars = step2.split('');
  for (let i = 0; i < step3chars.length - 1; i += 2) {
    let temp = step3chars[i];
    step3chars[i] = step3chars[i + 1];
    step3chars[i + 1] = temp;
  }
  let p1Challenge = step3chars.join('');
  
  const p1Answer = word1;

  // Additional clue: show the shift value and encoded hex of the first letter
  const firstLetterHex = '0x' + word1.charCodeAt(0).toString(16).toUpperCase();

  // --- Puzzle 2: Advanced Logic Grid ---
  // Pattern: (col1² + col2) = col3  — not obvious at first glance
  const p2a1 = (hash % 4) + 2;  // 2-5
  const p2b1 = (hash % 7) + 3;  // 3-9
  const p2a2 = p2a1 + 1;
  const p2b2 = p2b1 + 2;
  const p2a3 = p2a1 + 3;
  const p2b3 = p2b1 + 1;
  const p2a4 = p2a1 + 2;
  const p2b4 = p2b1 + 3;

  const row1result = (p2a1 * p2a1) + p2b1;
  const row2result = (p2a2 * p2a2) + p2b2;
  const row3result = (p2a3 * p2a3) + p2b3;
  const p2Answer = String((p2a4 * p2a4) + p2b4);

  // --- Puzzle 3: Hex Dump Decoder (replaces trivial QR) ---
  const hexWord = TECH_WORDS[(idx + 15) % 40];
  // Convert word to hex bytes with noise bytes injected
  const hexBytes = [];
  const noiseByte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
  // Seed the noise RNG deterministically
  let nSeed = hash;
  const detNoise = () => { nSeed = (nSeed * 1103515245 + 12345) & 0x7fffffff; return (nSeed % 256).toString(16).padStart(2, '0').toUpperCase(); };
  // Build hex dump: real bytes at positions divisible by 3 (0,3,6,9...), noise elsewhere
  const allHex = [];
  let realIdx = 0;
  for (let i = 0; i < hexWord.length * 3; i++) {
    if (i % 3 === 0 && realIdx < hexWord.length) {
      allHex.push(hexWord.charCodeAt(realIdx).toString(16).padStart(2, '0').toUpperCase());
      realIdx++;
    } else {
      allHex.push(detNoise());
    }
  }
  // Format as hex dump rows (8 bytes per row)
  let hexDump = '';
  for (let i = 0; i < allHex.length; i += 8) {
    const addr = (i).toString(16).padStart(4, '0').toUpperCase();
    const row = allHex.slice(i, i + 8).join(' ');
    hexDump += `0x${addr}: ${row}\n`;
  }

  // --- Puzzle 4: Cipher Chain (riddle answer becomes Vigenère key) ---
  const riddle = RIDDLES[idx];
  // Vigenère encrypt a hidden confirmation word
  const confirmWord = TECH_WORDS[(idx + 25) % 40];
  const vKey = riddle.a.toUpperCase().replace(/[^A-Z]/g, '');
  let vEncrypted = '';
  let keyIdx = 0;
  for (let i = 0; i < confirmWord.length; i++) {
    const c = confirmWord.charCodeAt(i) - 65;
    const k = vKey.charCodeAt(keyIdx % vKey.length) - 65;
    vEncrypted += String.fromCharCode(((c + k) % 26) + 65);
    keyIdx++;
  }

  const puzzles = [
    {
      id: 1,
      title: 'Multi-Layer Cipher Protocol',
      difficulty: 'HARD',
      description: `An intercepted transmission has been encrypted using a 3-layer cipher. To decode:`,
      challenge: p1Challenge,
      customHtml: `
        <div class="cipher-steps" style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,26,26,0.15); border-radius:8px; padding:1rem; margin-bottom:1rem; font-family:var(--font-mono); font-size:0.78rem; color:var(--text-secondary); line-height:2;">
          <div style="color:var(--neon-cyan); margin-bottom:0.5rem; font-weight:bold;">⚡ DECRYPTION LAYERS (reverse order):</div>
          <div><span style="color:#ff6b3d;">Layer 3:</span> Un-swap adjacent character pairs (BA→AB)</div>
          <div><span style="color:#ff6b3d;">Layer 2:</span> Reverse the entire string</div>
          <div><span style="color:#ff6b3d;">Layer 1:</span> Caesar shift each letter BACK by <span style="color:var(--neon); font-weight:bold;">${shift}</span></div>
          <div style="margin-top:0.5rem; color:var(--text-dim); font-style:italic;">// First letter hex: ${firstLetterHex}</div>
        </div>
      `,
      hintText: `Undo the layers in reverse order: un-swap pairs, reverse, then shift back by ${shift}.`,
      answer: p1Answer,
      hint: `After all 3 layers are undone, the answer is a tech word starting with "${p1Answer.substring(0,2)}..."`,
      validate(input) { return input.trim().toUpperCase() === this.answer; }
    },
    {
      id: 2,
      title: 'Logic Core',
      difficulty: 'HARD',
      description: 'The core processor requires a missing frequency. Identify the hidden operation between columns.',
      challenge: 'Find the missing value (?)',
      customHtml: `
        <div class="logic-grid-wrapper" style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px; font-family:var(--font-mono); font-size:1.4rem; color:var(--neon); font-weight:bold; text-align:center;">
          <div style="display:flex; justify-content:space-around; background:rgba(0,255,170,0.05); padding:8px; border-bottom:1px solid rgba(0,255,170,0.2); font-size:0.7rem; color:var(--neon-cyan); letter-spacing:2px;"><span>COL_A</span><span></span><span>COL_B</span><span></span><span>OUTPUT</span></div>
          <div style="display:flex; justify-content:space-around; background:rgba(255,26,26,0.05); padding:12px; border:1px solid rgba(255,26,26,0.2); border-radius:6px;"><span>${p2a1}</span><span style="color:#666;">|</span><span>${p2b1}</span><span style="color:#666;">|</span><span>${row1result}</span></div>
          <div style="display:flex; justify-content:space-around; background:rgba(255,26,26,0.05); padding:12px; border:1px solid rgba(255,26,26,0.2); border-radius:6px;"><span>${p2a2}</span><span style="color:#666;">|</span><span>${p2b2}</span><span style="color:#666;">|</span><span>${row2result}</span></div>
          <div style="display:flex; justify-content:space-around; background:rgba(255,26,26,0.05); padding:12px; border:1px solid rgba(255,26,26,0.2); border-radius:6px;"><span>${p2a3}</span><span style="color:#666;">|</span><span>${p2b3}</span><span style="color:#666;">|</span><span>${row3result}</span></div>
          <div style="display:flex; justify-content:space-around; background:rgba(255,107,61,0.1); padding:12px; border:1px solid rgba(255,107,61,0.4); border-radius:6px;"><span>${p2a4}</span><span style="color:#666;">|</span><span>${p2b4}</span><span style="color:#666;">|</span><span style="color:#ff6b3d; animation: pulse 1.5s infinite alternate;">?</span></div>
        </div>
      `,
      hintText: 'The operation is NOT simple multiplication or addition. Think about what you can do with COL_A alone first, then factor in COL_B.',
      answer: p2Answer,
      hint: 'Try squaring COL_A, then adding COL_B.',
      validate(input) { return input.trim() === this.answer; }
    },
    {
      id: 3,
      title: 'Memory Hex Dump',
      difficulty: 'EXPERT',
      description: 'A corrupted memory dump was intercepted. Extract the hidden keyword by reading ONLY every 3rd byte (positions 0, 3, 6, 9...) and converting from hex to ASCII.',
      challenge: 'Extract the signal from the noise.',
      customHtml: `
        <div style="background:rgba(0,0,0,0.6); border:1px solid rgba(0,255,170,0.2); border-radius:8px; padding:1.2rem; margin-bottom:1rem; font-family:var(--font-mono); font-size:0.85rem; line-height:1.8;">
          <div style="color:var(--neon-cyan); margin-bottom:0.8rem; font-weight:bold; font-size:0.7rem; letter-spacing:2px;">📦 MEMORY DUMP – SECTOR ${(hash % 99).toString().padStart(2,'0')}</div>
          <pre style="color:#00ffaa; margin:0; white-space:pre-wrap; word-break:break-all;">${hexDump}</pre>
          <div style="margin-top:0.8rem; border-top:1px solid rgba(255,26,26,0.2); padding-top:0.8rem;">
            <div style="color:var(--text-dim); font-size:0.7rem; line-height:1.6;">
              <span style="color:#ff6b3d;">⚠ INSTRUCTIONS:</span> Bytes are indexed 0,1,2,3,4,5... per row.<br/>
              Read ONLY bytes at positions <span style="color:var(--neon);">0, 3, 6, 9, 12...</span> (every 3rd, starting from 0).<br/>
              Convert those hex values to ASCII characters.<br/>
              <span style="color:var(--text-dim); font-style:italic;">// Tip: 0x41='A', 0x42='B', ... 0x5A='Z'</span>
            </div>
          </div>
        </div>
      `,
      hintText: 'Take byte at position 0, skip 2, take byte at position 3, skip 2, etc. Convert each hex to its ASCII letter (e.g. 53 = S).',
      answer: hexWord,
      hint: `The hidden word starts with "${hexWord.substring(0,2)}..."`,
      validate(input) { return input.trim().toUpperCase() === this.answer; }
    },
    {
      id: 4,
      title: 'Cipher Chain Enigma',
      difficulty: 'FINAL',
      description: 'Two-step challenge: First solve the riddle to find the KEY. Then use that key to Vigenère-decrypt the ciphertext below.',
      challenge: `Ciphertext: ${vEncrypted}`,
      customHtml: `
        <div style="background:rgba(0,0,0,0.5); border:1px solid rgba(255,26,26,0.2); border-radius:8px; padding:1.2rem; margin-bottom:1rem; font-family:var(--font-mono); font-size:0.82rem; line-height:1.8;">
          <div style="color:#ff6b3d; font-weight:bold; margin-bottom:0.8rem; font-size:0.7rem; letter-spacing:2px;">STEP 1 — RIDDLE (find the key):</div>
          <div style="color:var(--text-primary); font-style:italic; font-size:0.95rem; margin-bottom:1rem; padding:0.8rem; border-left:2px solid var(--neon);">"${riddle.q}"</div>
          <div style="color:#ff6b3d; font-weight:bold; margin-bottom:0.5rem; font-size:0.7rem; letter-spacing:2px;">STEP 2 — VIGENÈRE DECRYPT:</div>
          <div style="color:var(--neon); font-size:1.2rem; font-weight:bold; letter-spacing:4px; margin-bottom:0.8rem;">${vEncrypted}</div>
          <div style="color:var(--text-dim); font-size:0.7rem; line-height:1.6; border-top:1px solid rgba(255,26,26,0.15); padding-top:0.5rem;">
            <span style="color:var(--neon-cyan);">Vigenère formula:</span> Plain[i] = (Cipher[i] − Key[i]) mod 26<br/>
            Use the riddle answer as the repeating key. Submit the decrypted word.
          </div>
        </div>
      `,
      hintText: 'Solve the riddle first. Then for each letter: subtract the key letter position from the cipher letter position (mod 26).',
      answer: confirmWord,
      hint: `The riddle answer is "${riddle.a}". Use it as the Vigenère key to decrypt "${vEncrypted}".`,
      validate(input) { return input.trim().toUpperCase() === this.answer; }
    }
  ];

  const finalCode = `${p1Answer}-${p2Answer}-${hexWord}-${confirmWord}`;

  return { puzzles, finalCode };
}
