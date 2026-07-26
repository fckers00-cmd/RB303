# RB-303 → Acid Box · HANDOFF

เอกสารส่งต่องานสำหรับเซสชันถัดไป — โค้ดจริงทั้งหมดอยู่ใน `rb303.html` ไฟล์เดียวจบ

---

## 1) เป้าหมายที่ล็อกไว้

ผู้ใช้ = product/direction · Claude = software engineer ที่ลงมือทำจริง
เป้าหมายหลักคือ **เรียนรู้ DSP** และเล่นได้จริงบนมือถือ ไม่ใช่ทำ product ขาย

Target: **"acid box จอเดียว"** = 303 หนึ่งตัว + กลอง 5 เสียง + Delay + Mute ต่อแทร็ค

ตัดออกโดยเจตนา (YAGNI — ของที่สร้างแล้วไม่ใช้คือภาระติดลบ): 303 ตัวที่สอง, เครื่องกลองตัวที่สอง (โดยเฉพาะ 909 ที่ hi-hat จริงเล่นจาก sample ROM), song mode, pattern banks (I/II/III/IV, A/B บนแผ่น Roland), compressor, PCF, pan, velocity, triplet mode

หลักที่ใช้ตลอด: **"ออกแบบเผื่อ ไม่สร้างเผื่อ"** — Engine เป็น class แยกต่อ voice, ctl interface กลาง, knob set แยกต่อแทร็ค → เติมทีหลังได้โดยไม่รื้อ

### วิธีทำงาน
อยู่ใน **Project instructions** แล้ว (กฎเหล็ก · วิธีวัดเสียงให้ถูก · สัญญาณจากผู้ใช้ · ข้อจำกัดของผู้ใช้)
ไฟล์นี้เก็บเฉพาะ **สถานะทางเทคนิค** ไม่ซ้ำกับ instructions

---

## 2) สถานะปัจจุบัน

### 303 (เสร็จ)
- PolyBLEP oscillator (saw/square), hybrid diode-ladder filter, amp/filter envelope, accent, slide
- **Time mode ครบตามเครื่องจริง**: step เก็บ `t` = `1` note (●) / `2` tie (○) / `0` rest (—) · pitch มีความหมายเฉพาะ `t===1` เหมือนเครื่องจริง
- **Pattern length 1–16** · step นอกช่วงจางลงในกริด
- **Gate length** — โน้ตธรรมดาปิด gate ที่ 55% ของ step (`TUNING.gateRatio`)
- Knob 7 ตัว: Tune, Cut Off, Reso, Env Mod, Decay, Accent, Drive

### กลอง 5 เสียง (เสร็จ)
- BD / SD / CP / CH / OH สังเคราะห์ล้วนสไตล์ 808 · step = `{on, accent}`
- Choke CH→OH · **วัดแล้วไม่ click ที่ 2ms** (ดู §6)
- **Knob เฉพาะ SD กับ CP** — BD/CH/OH ยังไม่มี (ตั้งใจ รอผลจากหูก่อน)

### Delay (เสร็จ)
- **insert บนสาย 303 เท่านั้น** (ไม่ใช่ master — kick เข้า feedback loop จะทำให้ย่านต่ำเละ)
- **sync กับ tempo** 6 division: 1/16 · 1/8T · 1/8 · 1/8. · 1/4 · 1/2 · เปลี่ยน tempo แล้วหัวอ่านกระโดด (ตกลงกันแล้ว — ตรงจังหวะสำคัญกว่า artefact ตอนลาก slider)
- **one-pole LP ใน feedback loop** → เสียงย้ำมืดลงเรื่อยๆ แบบเทป (วัดได้ 1.42 → 0.37)
- **tanh ตอนเขียนลง buffer** = กัน runaway ถาวร (เทสต์ 20 วิที่ fb สูงสุด peak 1.73 ไม่ NaN)
- อยู่ใน **panel แยก** ไม่ใช่ knob set ของ voice — เพราะเป็นกล่องกลางที่ voice ป้อนเข้า ไม่ใช่คุณสมบัติของ voice (เหตุผลเดียวกับที่ send amount ต้องแยกจาก effect param ตอนทำ send rack)
- ship มาที่ **Mix = 0 (ปิด)** เพื่อไม่ให้เสียงเปลี่ยนโดยไม่ได้ขอ
- เขียนเป็นคลาส **sample เข้า/ออก ไม่ผูกกับ 303** → ย้ายไป send bus ได้โดยไม่แตะ DSP แค่ย้ายจุดเรียก `process()`

### UI — app shell (โครงใหม่)
**3 ส่วน**: `deck` ปักหมุดบน → `page` เลื่อนได้ตรงกลาง → `tabs` ล่างจอ
- **deck ไม่หายไปไหน**: transport · track selector · PITCH/TIME + Length · step grid
  เหตุผลเดียวกับฮาร์ดแวร์ — ปุ่ม trig อยู่ใต้มือเสมอไม่ว่าจะเปิดหน้าไหน · หมุน knob แล้วยังเห็น playhead วิ่ง
- **5 แท็บ**: VOICE · STEP · FX · MIX · BANK (ล่างจอ = นิ้วโป้งถึง)
- **ปุ่ม ▲ พับ grid** เมื่อหน้าล่างต้องการที่ · จงใจให้กดเอง ไม่พับอัตโนมัติ (ไม่งั้นของขยับใต้นิ้วกลางทาง)
- **แตะ step แล้วเด้งไป STEP อัตโนมัติ เฉพาะ PITCH mode** — TIME mode กับกลองไม่เด้ง เพราะกำลังไล่แตะรัวๆ
  ทำได้เพราะ grid ปักหมุด: ไปหน้า editor แล้วยังแตะ step ต่อได้เลย กรอกทั้งแผ่นโดยไม่ต้องสลับหน้าไปมา

**วิธี refactor ที่ใช้ (ความเสี่ยงต่ำ)**: **ย้าย DOM node เดิมทั้งก้อน ไม่ rebuild** — ทุก element คง id เดิม ทุก handler เดิมยังผูกอยู่ · หน้าใช้ show/hide ไม่ใช่สร้างใหม่
⚠️ canvas ที่ถูกซ่อนอยู่วัดขนาดไม่ได้ → ต้อง `sizeScope()` ตอนเปิดหน้า voice
⚠️ `ui_test.js` ตรวจว่า id ที่ JS เรียกมีครบไม่ซ้ำ, deck มีของครบ, page/tab ตรงกัน, ไม่มี panel หาย

### Save/Share
- **URL hash** `#p=` + base64(JSON) อัตโนมัติ (debounce 250ms, `history.replaceState`) — สำหรับแชร์ทีละ pattern
- **Bank 8 ช่อง** ใน localStorage · ตั้งชื่อได้ · Save/Del/Export/Import · undo 5 วินาทีทุกการกระทำ
  (จำกัด 8 ช่องโดยเจตนา — เก็บได้ไม่จำกัดจะกลายเป็นกองที่ไม่มีใครกลับไปเปิด)

---

## 3) สถาปัตยกรรม (ต้องรู้ก่อนแก้)

- DSP core อยู่ระหว่าง `/* ==== DSP CORE BEGIN ==== */` … `/* ==== DSP CORE END ==== */` — เทสต์ extract ส่วนนี้ไปรันใน Node
- `WORKLET_CODE` ประกอบจาก `JSON.stringify(TUNING)` + `tanh/midiToFreq/polyblep/DrumKick/DrumSnare/DrumClap/DrumHat/Engine` (`.toString()`) + Voice303 wrapper
  → **เพิ่มคลาส/ฟังก์ชันใหม่ใน core ต้องเพิ่มเข้า list นี้ด้วย ไม่งั้น worklet พังแต่ fallback ยังทำงาน = บั๊กหายาก**
- **`seq` / `snd` split** — state ถูกแยกเป็นสองกล่องตั้งแต่ระดับ serialisation:
  `seqSnapshot()/applySeq()` = การเล่น (pattern 303, กลอง, length) · `sndSnapshot()/applySnd()` = เสียง (wave, knob, mixer, tempo)
  ตอนนี้โหลดพร้อมกันเสมอ ใช้งานไม่ต่างจากรวมเป็นก้อนเดียว **แต่ song mode จะไล่เฉพาะ `seq` โดยล็อก `snd` ไว้**
  ไม่งั้นเปลี่ยนท่อนทีเสียงกระโดดทั้งชุด · **automation จะไปเกาะ `seq`** เพราะการหมุนปุ่มตามจังหวะเป็นส่วนหนึ่งของการเล่น
  ⚠️ `bank_test.js` มีเทสต์คุมไม่ให้สองกล่องนี้รั่วใส่กัน — ถ้าพังคือ song mode ทำไม่ได้
- **`renderDials(host,set)`** — ตัวเรนเดอร์ knob ตัวเดียว ใช้ได้ทั้ง Voice panel และ FX panel (เพิ่ม panel ใหม่ไม่ต้องเขียน knob ใหม่)
- **ctl interface** (จุดต่อ UI ↔ engine ทั้งสองโหมด):
  `setParam(k,v) / setPattern(p) / setStep(i,d) / setDrums(d) / setDrumStep(t,i,d) / previewDrum(t) / preview(note) / play() / stop()`
- เส้นเสียง: Engine → **AnalyserNode** → destination · voice ใหม่ต้อง sum เข้าจุดเดียวกันนี้
- `ensureAudio()` เป็น single-flight guard — ห้าม `new AudioContext` ที่อื่น
- ScriptProcessorNode ต้อง push เข้า `keepAlive[]` กัน GC
- Playhead + scope วาดผ่าน rAF loop เดียว — **ห้ามแตะ DOM ใน audio callback**

### กฎเหล็กใน sample loop
**ห้ามสร้าง closure/object ใดๆ** — GC pause = เสียง pop (`polyblep` ถูก hoist เป็นฟังก์ชันเดี่ยวด้วยเหตุนี้)

### บทเรียนจากบั๊กจริง 2 ตัว
1. ตัวแปร `let` ที่ถูกเรียกตอน build UI (เช่น `booted` ใน `saveHash`) ต้องประกาศ**ก่อน**ส่วน build → ไม่งั้น TDZ ReferenceError ตายทั้งหน้าเงียบๆ
2. แก้คลาสแล้วเหลือ method ซ้ำค้างนอกคลาส → SyntaxError ตายทั้งหน้า
   **ทั้งสองตัวถูกจับด้วย `smoke.js` ทันที — นี่คือเหตุผลที่เทสต์นั้นมีอยู่**

---

## 4) Hash format

ปัจจุบัน **v4** · โครง: `{v, t:tempo, w:wave, k:knobs, l:len, s:steps303, d:drums, m:mixer}`

| field | รูปแบบ |
|---|---|
| `s` | array 16 ตัว `[note, t, accent, slide]` — `t` = 0 rest / 1 note / 2 tie |
| `d` | object ต่อแทร็ค เป็น string 16 ตัวอักษร `0`=off `1`=on `2`=on+accent |
| `m` | object mixer `{v303,vBD,vSD,vCH,vOH,vCP,vMas}` ทุกค่า 0–1 |
| `l` | pattern length 1–16 |

**Backward compat ที่ต้องรักษาไว้** (มีเทสต์คุมอยู่):
- v≤3: slot 1 ของ `s` เป็น on/off ธรรมดา → แปลงเป็น note/rest **ห้ามเสก tie ขึ้นมาเอง**
- v1: ไม่มี `d` → drums เงียบทั้งหมด (ลิงก์คือ full state)
- v≤2: ไม่มี `m` → ใช้ค่า mixer เริ่มต้น

**เพิ่ม field ใหม่เมื่อไหร่ ต้องขึ้นเวอร์ชันและเพิ่มเทสต์ใน `hash_test.js` ด้วยเสมอ**

---

## 5) DSP design และเหตุผล

### Filter 303
**TPT 4-pole ladder core** (Moog topology — เลือกเพราะ resonate เสถียร self-oscillate ได้) + คลุมด้วย 4 traits ของ 303 จริง:

1. **18dB tap** `out = y3*0.72 + y4*0.28` — จำลอง "flawed 24dB" ของ diode ladder
2. **HP ~180Hz ใน resonance feedback loop** — จากการวัดเครื่องจริง (a1k0n / x0xb0x)
3. **tanh clip ที่ input** — grit แตกเร็วแบบ diode
4. **DC blocker หลัง filter + VCA อยู่หลัง filter** — resonance ring ต่อได้ตอนปล่อยโน้ต

เคยลอง coupled diode ladder แท้ → over-damped (RMS ตกเมื่อ reso ขึ้น ไม่ scream) จึงเลือก hybrid
ถ้าจะไล่ authenticity อีก ~5% สุดท้าย ให้ศึกษา Open303 ของ Robin Schmidt แต่ต้อง oversample หนัก

### Time mode / gate — ที่มาของการแก้ครั้งใหญ่
เดิมโน้ตติดกันไม่เคยปิด gate เลย → **ทุกโน้ตเป็น tie โดยไม่ตั้งใจ** ทำให้ pattern ที่กรอกจากแผ่นไม่เหมือนต้นฉบับ
วัดยืนยัน: โน้ต 4 ตัวติดกันได้ RMS เรียบ `0.42` ตลอดไม่มีตกเลย

หลังแก้ (RMS ซอย ¼ step · `.` เงียบ `#` ดัง):
```
● ● ● ●   ##+.|##+.|##+.|##+.|
● ○ ○ ○   ####|####|####|##+.|
● — ● —   ##+.|....|##+.|....|
```

Engine มองข้างหน้า 1 step: ถ้า step ถัดไปเป็น tie **หรือ** step นี้มี slide → ถือ gate ข้ามเส้นแบ่ง (`gateLeft = -1`)
tie หลัง rest = เงียบต่อ (ไม่มีอะไรให้ลาก) — ได้มาฟรีจากการเช็ค `if(this.gate)`

### Snare — รอบแก้ "กลวง" (รอบสอง) + bug ระดับมิกซ์
ผู้ใช้รายงาน "กลวงอีกแล้ว" หลังรอบ 809 · วัดแล้วเจอ **3 สาเหตุซ้อนกัน**:

1. **default Snap อยู่ผิดที่** — ที่ 0.55 ค่า body=0.90 / noise=0.27 (7:1) = ยังเป็น tom
   ต้นเหตุ: ใช้ `smoothstep` กับแกน snare → ครึ่งแรกของโซน snare แทบไม่มี noise
   **แก้: ใช้ power < 1** (`noiseCurve:0.55`) → พ้นขอบ tom แล้วได้ wire ทันที · ย้าย default → 0.70
2. **body ring เป็นโทนบริสุทธิ์** — 76% ของพลังงานหางอยู่ที่ fundamental · body decay 86ms ใกล้ noise 102ms → หางเป็น "โทน" ไม่ใช่ "wire"
   **แก้: body ตายเร็วกว่า noise มาก** (bodyDecMin 45→26ms) → หางกลายเป็น noise
3. **saturation บูสต์หาง** — `tanh(x·s)/tanh(s)` ทำให้ peak คงที่แต่ส่วนเบาถูกคูณ ~2.4x → ring ดังขึ้นเทียบกับหัว (attack/tail แค่ 4.2 dB)
   **แก้: ลด satMin/satMax และ outDrive** → attack/tail 4.2 → 9.0 dB

**ผลวัดที่ default (Snap 70%)**: tail@fundamental 76%→27% · attack/tail 4.2→9.0 dB · wire content 1%→37% · body/noise −6.7→−0.1 dB

### ⚠️ Bug ระดับมิกซ์ที่เจอพร้อมกัน (สำคัญ)
1. **crest factor** — SD 13 dB, CP 16 dB (BD แค่ 5) · พอบาลานซ์ด้วย **RMS** ให้ได้ยิน peak เลยพุ่งไป 2.3–3.3 → ชน master clip → **ทั้งมิกซ์ถูกดึงลง 9 dB ทุกครั้งที่กลองลง = pumping**
   **แก้: output saturation ต่อ voice** (SD/CP) ลด crest เหลือ 8–9 dB โดย RMS คงเดิม
2. **master fader อยู่หลัง clipper** — `tanh(sum)*mvMas` → หมุน master ลงไม่ได้ช่วยลดความแตกเลย ผู้ใช้แก้เสียงแตกไม่ได้
   **แก้: `tanh(sum*busGain*mvMas)`** — master กลายเป็น drive เข้า clipper ตามที่ desk จริงทำ
3. **busGain 0.42** = headroom คงที่ของบัส · worst-case duck −9 → −3 dB
   ⚠️ **ถ้าเปลี่ยน level ของ voice ใดต้องเช็ค bus headroom test ใหม่** (เคยพลาด: ดัน SD ขึ้นแล้ว bus เกินทันที)

### ⚠️ เทสต์เคยไม่ fail จริง
`test_dsp.js` เดิมแค่ `console.log('FAIL')` แล้ว exit 0 → run.sh ขึ้น "ผ่านทั้งหมด" ทั้งที่พัง
**แก้แล้ว**: มี `fail()` + `process.exitCode=1` · พิสูจน์แล้วว่า break busGain → exit 1 จริง

### "Hollow" — วัดได้ ไม่ใช่ความรู้สึก (สำคัญมาก)
ผู้ใช้บ่นว่า snare กลวง **ตัวชี้วัดคือ: ยอด resonance ของ body สูงกว่าพื้น noise กี่ dB**
วัดที่ความหนาแน่นพลังงาน 170-340Hz เทียบ 600-1500Hz · ยอดสูงลอยเหนือพื้นแบนๆ = หูได้ยินเป็น "ท่อ" ไม่ใช่กลอง
- ~25 dB = tom เต็มตัว (ถูกต้องสำหรับฝั่งซ้ายของ Snap)
- ~17 dB = **กลวง** ← default เดิมอยู่ตรงนี้
- ~11-13 dB = snare ที่ฟังดี

**ต้นเหตุจริง: default ของ Snap ปาร์กอยู่ในโซนกลวง ไม่ใช่ตัว voice เสีย** · แก้โดยย้าย default 0.55 → **0.78**
หลักฐานสนับสนุน: patch ที่ผู้ใช้เซฟเองตั้ง sdSnappy ไว้ **0.94** = เขาหมุนหนีโซนกลวงอยู่แล้ว

**สิ่งที่ลองแล้วไม่ได้ผล (อย่าเสียเวลาซ้ำ)**:
- เพิ่ม saturation → **แย่ลง** (17.4→20 dB) เพราะไปกดหัวเสียงและดันหางขึ้น
- ลด body decay ครึ่งหนึ่ง → ดีขึ้นแค่ 0.6 dB
- เพิ่มโหมดเป็น 4-5 (membrane ratios) → ไม่ช่วย โหมดทั้งหมดอยู่ย่านเดียวกัน
- เปลี่ยน smoothstep เป็น power curve → ดีขึ้นแค่ 0.9 dB
- **บทเรียนวิธีวัด**: เคยวัดเป็น % พลังงานต่อแบนด์ แล้วสรุปผิดว่ามี "ช่องว่าง" ที่ 430-1.2k — จริงๆ แบนด์กว้างกว่าย่อมมีพลังงานรวมมากกว่าเสมอ **ต้องวัดความหนาแน่นต่อ Hz** ไม่ใช่ผลรวม

### Clap — จูน (ไม่ได้รื้อ)
**อาการเดิม**: สว่างไป centroid ~2.7k (clap จริง 1-2k) → ฟังเป็น "noisy snare สว่างๆ" ไม่ใช่มือตบ · burst 3 ชุดสมานเป็นก้อนเดียวที่ spread ปกติ
**ที่จูน** (คง 3 ปุ่มเดิม): bandpass ต่ำลง 1050→780Hz + **เพิ่ม lowpass roof** (pitch×1.5) ตัด "tss" · เพิ่มเป็น **4 burst** taper 0.86 (แต่ละตบเบาลง) → attack ฟูขึ้น
ผล: centroid default = 1984Hz (เข้าเป้า) · pitch ยังกวาด 1079→3425Hz
**Decay range แก้** (ผู้ใช้บ่นว่าต้องหมุนสุดถึงจะกรอบ): เดิม floor 40ms → 0% ยังหลวม (192ms หาง) · **ตัวคุมความกรอบจริงคือ tailDecayS floor ไม่ใช่ spread** (spread แคบทำให้ burst ซ้อนเป็นก้อนยาว = หลวมกว่าเดิม เกือบหลงทาง) · แก้ floor 40→6ms · ตอนนี้ knob 0%=49ms(กรอบ) default 30%=75ms 100%=496ms(หลวม)
**⚠️ ระดับ**: clap เป็น burst สั้นๆ พลังงานต่ำโดยธรรมชาติ (raw RMS 0.086) ต้อง `level:9.5` + fader 0.60 ถึงจะอยู่ **-5 dB ใต้ kick** · raw peak เลย 1.0 ได้ (fader ดึงลง) — เทสต์ solo peak≈1 เดิมใช้ไม่ได้แล้ว เปลี่ยนเป็น **kit balance test** วัด dB ในมิกซ์แทน

**ยังไม่ได้ทำ (ถ้าอยากได้ clap แท้)**: room simulation — clap จริงคือ burst เดียวกันเล่นซ้ำผ่านห้องที่มี reverb · เรามีแค่ bandpass tail ไม่มีห้อง · จูนแล้วดีขึ้นแต่ถ้าอยาก "เป็น clap ไม่ใช่ snare" ต้องเพิ่ม feedback taps สั้นๆ (ครึ่งวัน, ปุ่ม Room ใหม่)

### Snare — 809 rebuild (รื้อใหม่ทั้งตัว)
**อาการเดิม**: เสียงบางและกลวง ผู้ใช้บอกว่า "เหมือน cymbal หรือ hi-hat อีกตัว" — เพราะ body เป็น sine คู่สะอาดๆ เบาไป noise เลยเด่นจนหูจัดเป็นเครื่องเคาะโลหะ ซ้ำร้าย bandpass ที่ผมใส่ตอนแก้ Snappy ทำให้ noise ยิ่ง "ร้อง" เป็น tone = ยิ่งเหมือน cymbal

**ที่แก้**:
1. **body = dual resonance + pitch drop + tanh saturation** — sat เป็นตัวทำให้ body ฟังเป็น "กลอง" ไม่ใช่ "โทน" (แก้กลวง) และ body ที่หนักขึ้นเป็นฐานให้ noise เกาะ (แก้เหมือน hi-hat)
2. **noise band กว้างขึ้น Q ต่ำลง** (Q 0.7) ไม่ track pitch แบบเป๊ะ → ฟังเป็น "rattle" ไม่ใช่ "ring"

**Snap เป็น bipolar (plan B)**: knob เดียว = แกน tom↔snare
- 0–33% = โซน tom (body ล้วน, noise หายไปทางซ้ายสุด) · 33–100% = โซน snare
- **ไม่มีปุ่ม BODY แยก** — ความหนาของ body เป็นฟังก์ชัน baked ของตำแหน่ง Snap (หมุนทีเดียวได้จุดบนเส้น tom-snare ไม่ต้อง balance สองปุ่ม)
- ผู้ใช้ตัดสิน: **ไม่อยากได้กรณี "crack เดิมแต่หนักขึ้น"** จึงยืนยัน 3 ปุ่มพอ

**ตัวเลขวัดหลังรื้อ** (Snap tom→snare):
- swing loudness = 1.5 dB (ยอมให้ tom หนักกว่านิดตามธรรมชาติ)
- timbre ขยับ 22.4 semitone
- **low-mid ที่ Snap 100% = 89%** ← หลักฐานว่า snare ยังมี body ไม่ยุบเป็น hi-hat (มีเทสต์คุม)
- punch (attack/rms) ไล่ 2.2→7.4 จาก tom ไป snare
- full mix peak 0.85 ไม่ clip

**⚠️ Crest factor / master clip** (เจอตอนผู้ใช้บอก "snare รู้สึกผิดปกติ"): snare/clap มีทรานเซียนต์แหลม crest 13/16 dB เทียบ kick 5 dB · พอบาลานซ์ด้วย **ค่าเฉลี่ย** ให้ได้ยิน → **ยอด** พุ่ง 2.3-3.3 ชน master soft-clip ทำให้ทั้งมิกซ์ถูกกด ~9 dB ทุกครั้งที่กลองลง (pumping)
แก้ 2 อย่าง: (1) **output saturation ต่อ voice** (`outDrive/outMakeup`) ลด crest เหลือ 8-9 dB โดยไม่เสียความดัง (2) **`busGain` + ย้าย master fader เข้าไปใน tanh** — เดิม `tanh(sum)*mvMas` แปลว่าหรี่ master ไม่ช่วยลดความแตกเลย ผู้ใช้แก้เสียงแตกไม่ได้ · ตอนนี้ `tanh(sum*busGain*mvMas)` ยอดกดเหลือ ~3 dB และ master คุมได้จริง
**⚠️ ระดับในมิกซ์**: หลังรื้อ snare เคยจมกว่า kick ถึง 14 dB (fader default 0.42 ค้างมาจาก snare บางตัวเก่า) · แก้เป็น `level:1.20` + fader default **vSD 0.72** → SD อยู่ **-3.4 dB ใต้ BD** (พ็อกเก็ตที่ snare ควรอยู่) · CP ดันเป็น 0.48 ด้วย · comp coefficients เป็น ratio จึงไม่เปลี่ยนตาม level
**⚠️ semantics เปลี่ยน — pattern เก่ากระทบ**: `sdDecay` เดิมเป็นวินาที (0.04–0.6) ตอนนี้เป็น normalized (0–1) · `sdPitch` เดิม 70–400 ตอนนี้ 120–260 · `sdSnappy` เดิม unipolar ตอนนี้ bipolar · ค่าเก่า clamp เข้า range ได้ ไม่ crash แต่เสียงจะต่างไป (เลี่ยงไม่ได้เมื่อรื้อ voice)
**⚠️ comp เป็น cubic fit ตลอด throp** — ถ้าแก้ gain/sat ใน macro ต้อง re-fit (สคริปต์อยู่ที่ commit history / วิธี: วัด raw RMS ปิด comp แล้ว least-squares cubic)

### กลอง — latch ค่าตอน trigger
Knob กลองถูกอ่าน**ครั้งเดียวตอนถูกตี** ไม่ใช่ทุก sample
เหตุผล: เสียงกลองสั้น ไม่ต้องเปลี่ยนกลางเสียง → `Math.exp()` รันไม่กี่ครั้งต่อวินาที และ **ไม่ต้องมี smoothing เลย** เพราะค่าไม่ขยับระหว่างเสียงดัง
(ตรงกับเครื่องจริงด้วย — บิดปุ่มกลางเสียงไม่ได้เขียนเสียงที่ดังไปแล้วใหม่)

### ช่องว่าง authenticity ที่รู้อยู่ (ตั้งใจพักไว้)
accent buildup (ตัวเก็บประจุ C13), ของจริง accent บังคับ filter decay สั้นคงที่โดยไม่สน knob, env mod ไม่ใช่บวก octave ตรงๆ, hat ใช้ naive square (aliasing โดยเจตนา — ผ่าน BP/HP แล้วกลายเป็น inharmonic hash เข้าทางเสียง metallic)

---

## 6) ตัวเลขที่วัดไว้แล้ว (อย่าวัดซ้ำ ให้ต่อยอด)

### ประสิทธิภาพ
| | |
|---|---|
| 303 + กลอง 5 เสียงเต็มที่ | **6.4% CPU** peak 0.84 NaN 0 |
| หยุดเล่น เงียบสนิท | **3.4% CPU** (เดิม 8.3% ก่อนทำ voice deactivation) · ที่เหลือคือ 303 |

### ความแรงของ knob กลอง (วัดจาก spectral centroid / ความยาวหาง)
| ปุ่ม | ผลจากปลายถึงปลาย |
|---|---|
| SD Pitch | 8.9 semitone (ช่วงกว้างขึ้นเป็น 70–400Hz แล้ว) |
| SD Decay | หางยาวขึ้น 6.4 เท่า |
| SD Snappy | 28.8 semitone · ระดับเสียงนิ่ง 0.20 dB |
| CP Pitch | 11.6 semitone |
| CP Decay | หางยาวขึ้น 5.5 เท่า |
| CP Spread | เปลี่ยน**จังหวะ** ไม่ใช่ความถี่ — วัดด้วย centroid ไม่เห็น ต้องดู envelope · ใส่ `pow:3.1` แล้ว |

> **บทเรียนสำคัญ**: SD Pitch เคยตายสนิท (0.2 semitone) เพราะไปแตะแค่ body ซึ่งถูก noise กลบหมด
> แก้โดยให้ pitch ลาก noise bandpass ไปด้วย — **ปุ่มที่ดีต้องขยับหลายพารามิเตอร์พร้อมกัน ไม่ใช่ค่าเดียว**
> เทสต์ knob sweep เดิม (เช็ค NaN + peak) **ผ่านฉลุยทั้งที่ปุ่มตาย** → ต้องวัด "เสียงเปลี่ยนกี่ semitone" ด้วย

### CP Spread — ช่วงปุ่มออกแบบผิด (ผู้ใช้จับได้จากการเล่นจริง)
หูคนรวมเสียงที่ห่างกันต่ำกว่า ~30–50ms เป็นเสียงเดียว · clap มี 3 burst ดังนั้นช่วงรวม = spread × 3

| spread | ช่วงรวม | ได้ยินเป็น |
|---|---|---|
| 4ms | 12ms | เสียงเดียว (เปลี่ยน texture) |
| 8ms | 24ms | เสียงเดียว |
| 12ms | 36ms | เริ่มแยก = flam |
| 28ms | 84ms | flam เต็มตัว |

จุดตัดอยู่ที่ **~11–12ms = แค่ 1 ใน 3 ของระยะหมุน** → สองในสามของปุ่มอยู่ในโซนที่ไม่ได้ใช้จริง
**แก้แล้วด้วย `pow:3.1`** (ไม่ได้หดช่วง — flam ยังมีที่ใช้เป็นลูกเล่นตั้งใจ แค่ไม่ควรขวางโซนหลัก)
ตอนนี้: ปุ่ม 50% = 6.8ms · 70% = 11.9ms (จุดตัด) · 100% = 28ms

### SD ที่ Snappy ต่ำ = perc/tom (ได้มาฟรี — อย่าเผลอทำหาย)
centroid ที่ Snappy 0% ไล่ 278Hz → 616Hz ตามพิตช์ = เป็นเสียง**มีระดับเสียงชัด** ไม่ใช่ noise

| snappy | 110Hz | 182Hz | 260Hz | 340Hz |
|---|---|---|---|---|
| 0% | 278 | 507 | 533 | 616 |
| 15% | 799 | 1228 | 1538 | 1533 |
| 30% | 1221 | 1731 | 2113 | 2177 |

**เราตัด Tom ออกตาม YAGNI แต่กลายเป็นได้มันมาฟรีอยู่แล้ว** แค่หมุน Snappy ลงสุด
→ ตอนทำ Snappy macro **ห้ามกลบโซนนี้ทิ้ง มันคือฟีเจอร์ ไม่ใช่ผลข้างเคียง**
→ ข้อจำกัด: ช่วงพิตช์ตอนนี้ 110–340Hz (19.5 semitone) พื้นล่างสูงเกินไปสำหรับ tom ต่ำ (floor tom จริง ~80–100Hz)

### ผลตรวจกับสเปกภายนอก (ผู้ใช้เอาสเปก groovebox จากที่อื่นมาเทียบ)
| ข้อ | ผล |
|---|---|
| Snap 0↔1 ดังต่างไม่เกิน 2-3 dB | ✅ **ผ่านแล้ว — 0.20 dB** (เดิมตก 3.7 dB และแกว่งไม่เป็นเส้น) |
| choke ต้อง 5–18ms ไม่งั้น click | **ผ่านแม้ใช้ 2ms** — ความชันตอน choke 0.278 < ตอนเล่นปกติ 0.631 → ไม่ต้องแก้ |
| ห้าม reset noise seed ทุก hit | ผ่านอยู่แล้ว (noise เดินต่อเนื่อง ไม่ reset ใน `trigger`) |
| deactivate voice ต่ำกว่า -72dB | ✅ **ผ่านแล้ว** (`SILENT` const — ต้องอยู่ใน WORKLET_CODE list ด้วย) |

> สเปกนั้นมีบั๊ก: `fastSoftClip` clamp ที่ ±1.5 แต่อนุพันธ์ `1-x²` เป็นศูนย์ที่ x=1 → เลยไปคือพับกลับ
> (input 1.0 → 0.667 แต่ input 1.5 → 0.375) นั่นคือ wavefolder ไม่ใช่ soft clip · ถ้าจะใช้ต้อง clamp ±1.0

---

## 6.5) ทางที่ลองแล้วไม่เวิร์ก — อย่าเสียเวลาซ้ำ

| ลอง | ผล | บทเรียน |
|---|---|---|
| เพิ่ม saturation แก้ snare กลวง | **แย่ลง** 17.4→20 dB | sat กดหัวเสียงและดันหางขึ้น = กลวงกว่าเดิม |
| ลด body decay ครึ่งหนึ่ง | ดีขึ้นแค่ 0.6 dB | ไม่ใช่ lever |
| เพิ่ม body เป็น 4-5 modes (membrane ratios) | ไม่ช่วย | โหมดทั้งหมดอยู่ย่านเดียวกัน ไม่ได้อุดช่องไหน |
| เปลี่ยน smoothstep → power curve | ดีขึ้นแค่ 0.9 dB | mapping ไม่ใช่ตัวหลัก body/noise gain ต่างหาก |
| coupled diode ladder แท้ (filter 303) | over-damped ไม่ scream | จึงใช้ hybrid TPT + 4 traits แทน |
| หด Spread ให้แคบลงเพื่อให้ clap กรอบ | **กลับด้าน** burst ซ้อนกันเป็นก้อนยาว | ตัวคุมความกรอบคือ **tailDecay floor** ไม่ใช่ spread |
| quadrature formula สำหรับชดเชยระดับ | พลาด 5.6 dB | แต่ละส่วนมี decay ต่างกัน ต้อง **fit จากที่วัดจริง** |
| ย้าย default Snap หนี "โซนกลวง" | ผู้ใช้หมุนกลับมาโซนเดิม | **metric ขัดกับหูผู้ใช้ = metric ผิด** ตัวที่แก้จริงคือ master clip |

**บั๊กที่เทสต์จับไม่ได้ 1 ตัว — เทสต์เองนั่นแหละที่พัง**
ไฟล์เทสต์ทั้ง 5 hardcode ชื่อ `rb303.html` · พอเปลี่ยนแอปเป็น `index.html` เทสต์พังหมดทั้งชุดพร้อมกัน
โลคอลไม่เจอเพราะไฟล์ยังชื่อเก่า — **Codex เจอตอนรันในสภาพจริง**
แก้แล้ว: เทสต์ไล่หา `index.html` → `rb303.html` → `v2.html` เอง · `run.sh` เช็คไฟล์ครบก่อนรัน
→ **บทเรียน: เวลาบอกให้เปลี่ยนชื่อไฟล์ ต้องไล่ดูว่าใครอ้างชื่อนั้นอยู่บ้าง**

**บั๊กที่เคยเจอ 3 ตัว — เทสต์จับได้ทั้งหมด**
1. `let` ถูกเรียกก่อนประกาศ (TDZ) → หน้าตายเงียบ
2. method ซ้ำค้างนอก class หลังแก้ → SyntaxError หน้าตาย
3. `const SILENT` ไม่ถูกแทรกเพราะ pattern ไม่ match → ReferenceError
→ **`smoke.js` จับได้ทั้ง 3 ครั้ง นี่คือเหตุผลที่มันมีอยู่**

---

## 7) คิวงาน

### ✅ เสร็จแล้ว — 4 ชิ้นในคิวเดิม (ทำพร้อมกันรอบเดียว)

1. **Snappy เป็น macro จริง** — knob เดียวขยับ 5 อย่าง: noise gain · transient crack · ความสว่างของ noise band · ความยาวหาง noise · ลด body เล็กน้อย → แล้วหารด้วยค่าชดเชย
   ผล: **แกว่ง 3.7 dB → 0.20 dB** และไม่แกว่งขึ้นลงกลางทางแล้ว · texture ยังขยับ **28.8 semitone**
   ⚠️ `noiseG` ต้องเป็น **0 เป๊ะ** ที่ Snappy 0 — ความเงียบนั้นคือสิ่งที่เปิดให้ body โผล่มาเป็น perc
   ⚠️ **ค่าชดเชยเป็น cubic ที่ fit จากการวัด ไม่ใช่สูตรทฤษฎี** — ลองใช้ quadrature ก่อนแล้วพลาด 5.6 dB เพราะแต่ละส่วนมี decay ต่างกัน พลังงานไม่ได้รวมกันง่ายแบบนั้น · **ถ้าแก้ gain ในmacro ต้อง fit ใหม่ อย่าเดาปรับ**
2. **Voice deactivation** ที่ -72dB (`SILENT`) — **CPU ตอนหยุดเล่น 8.3% → 3.4%** · ที่เหลือคือ 303 ซึ่งยังไม่ปิด (filter reso สูงอาจ ring ค้างได้ ต้องคิดเงื่อนไขให้ดีกว่านี้ก่อน)
3. **Spread curve** `pow:3.1` — โซน 4–12ms กินระยะหมุน 70% แล้ว (เดิม 33%)
4. **SD Pitch 70–400Hz** — จาก 19.5 เป็น 30 semitone ปลดล็อกโหมด perc/tom

### ถัดไป
5. **P-locks** — ตกลงกันแล้วว่าจะทำ (ดู §7.5)
6. ~~Delay~~ ✅ เสร็จแล้ว — ตกลงแล้วว่า **insert บน 303** (ไม่ใช่ master เพราะ kick เข้า feedback loop จะกองเป็นโคลน) · **ใส่ one-pole LP ใน feedback loop** (เสียงย้ำทึบลงเรื่อยๆ แบบ dub) · **sync กับ clock แล้วปล่อยให้กระโดดตอนเปลี่ยน BPM**
   → เขียนเป็นคลาสรับ sample เข้า/คืน sample ออก **ไม่ผูกกับ 303** เผื่ออัปเป็น send bus ทีหลัง
   → จอง `Float32Array` ใน constructor ขนาด max delay (ห้าม allocate ใน loop)
7. **Send rack** (คุยไว้แล้ว): ปุ่ม send อยู่ข้าง mixer · **กล่อง effect แยกเป็น section ของตัวเอง** ไม่ยัดใน mixer (send amount = ต่อ voice, effect param = ตัวเดียวใช้ร่วม) · เก็บใน `snd` ทั้งคู่ ไม่ให้กระโดดตอนเปลี่ยน pattern
   → **reverb คืองานใหญ่จริง** (comb+allpass) และเป็นตัวที่จะให้ "ห้อง" กับ clap · delay ที่มีอยู่ย้ายเข้า rack ได้เลย
8. **Mute ต่อแทร็ค** — gain 0/1 ต่อ voice ก่อน sum · **แต่ผู้ใช้ใช้ mixer fader ลากซ้ายสุดแทนอยู่แล้ว** อาจไม่จำเป็นเท่าที่คิด

## 7.5) P-locks — ออกแบบไว้แล้ว รอลงมือ

ผู้ใช้เลือก **p-lock** (ค่าต่อ step) ไม่ใช่ motion recording · เทียบแล้วเหมือน effect column ของ tracker

**ทำไมถูกกว่ามาก**: step เป็น object อยู่แล้ว และ **knob กลอง latch ตอน trigger อยู่แล้ว** — p-lock คือ "อ่านค่านี้แทน" ณ จังหวะนั้น เครื่องมือมีครบแล้ว
ส่วน motion recording ต้องมี timeline, ความละเอียด, interpolation, UI ดู/ลบ lane

**สิ่งที่เครื่องจริงทำ** (ค้นมาแล้ว): Elektron = p-lock ต่อ step (กด step ค้างแล้วหมุน) · ReBirth = อัดการหมุนปุ่มแบบ real-time **แต่มีเฉพาะใน Song mode** — automation กับ song mode เป็นฟีเจอร์เดียวกันในนั้น · ReBirth ยังมี **PCF** = step sequencer แยกตัวขับ filter (เราตัดไปตาม YAGNI)

**บทเรียนจาก ReBirth ที่ต้องไม่พลาดซ้ำ**: v1 พอเข้า Song mode แล้วแตะปุ่ม = อัดทันที ต้อง commit · v2 แก้ให้แตะได้โดยไม่อัด
→ **การหมุนปุ่มต้องไม่อัดอะไรเงียบๆ ต้อง arm ก่อนเสมอ**

**แผนที่ตกลงไว้**
- โหมดที่สาม `LOCK` ต่อจาก `PITCH | TIME` — เลือก step แล้วหมุน knob = เขียนลง step นั้น (บนมือถือกด step ค้างไม่ได้ จึงใช้โหมดแทน)
- **303 ก่อน** 5 ค่า: cutoff, reso, envMod, decay, drive · ไม่เอา tune (โน้ตทำหน้าที่นั้นแล้ว) ไม่เอา accent (เป็น flag ต่อ step อยู่แล้ว)
- step ได้ field `p:{cutoff:900}` — ไม่มี = ใช้ค่า knob (เหมือน effect column ว่างใน tracker)
- **hash → v5** · bank format ไม่ต้องแก้ เพราะ lock อยู่ใน `seq` ตามที่วางไว้
- ต้องมี: ปุ่มล้าง lock ของ step, จุดบอกบน grid ว่า step ไหนมี lock, และ dial ต้องแสดงว่ากำลังถือค่า lock อยู่ไม่ใช่ค่า global

### รอหูผู้ใช้ตัดสิน (อย่าเดาแทน)
- **BD กับ CH/OH ควรได้ปุ่มอะไร** — หลักฐานจากการเล่นจริงถึงตอนนี้: ผู้ใช้ขยับ **Pitch กับ Decay ทั้ง SD และ CP** แต่**ไม่แตะ Spread เลย** → ถ้ายืนยันอีกรอบ ให้เริ่มที่ Pitch + Decay ก่อน ตัวที่สามค่อยว่ากัน
- เสียง snare หลังเปลี่ยน noise เป็น bandpass โอเคมั้ย หรือเสียตัวตนเดิมไป (ปรับได้ที่ `TUNING.sd.noiseQ` 1.4 / `noiseRatio` 9.0)

### ตัดสินใจไปแล้ว อย่ารื้อ
- **ไม่ทำแท็บแยกสำหรับ drum machine** — ให้ panel Voice วิ่งตาม track selector แทน (ไม่ต้องเรียนรู้ navigation ใหม่ + ไม่มี mixer ซ้อนสองที่ ซึ่งเป็นบ่อเกิดบั๊ก state)
- **Mixer เป็น slider ไม่ใช่ knob** — งานของมันคือ "เทียบ" ไม่ใช่ "ตั้งค่า" ตำแหน่ง fader อ่านเป็นบันไดได้ทันที
- **ไม่ทำ velocity** — เครื่องเราเป็น accent เปิด/ปิดตามแผ่น Roland ใส่ velocity จะมีสองระบบซ้อนกัน

### ของดีจากสเปกภายนอกที่เก็บไว้ใช้ตอนทำ BD/hat
**bipolar pitch curve** — กลางปุ่ม = เสียงปกติ, ใกล้กลางปรับละเอียด, ปลายเดินเร็ว
```js
const x = value*2-1;
const curved = Math.sign(x) * Math.pow(Math.abs(x), 1.6);
freq = baseHz * Math.pow(2, curved*rangeSemitones/12);
```
ดีกว่า log map ที่ใช้อยู่ตอนนี้สำหรับกลอง

---

## 8) TUNING

อยู่หัวไฟล์ แก้ที่เดียวมีผลทุก path · มี 2 ชั้น: ค่า 303 แบบ flat + sub-table ต่อ drum voice (`TUNING.bd/.sd/.cp/.hh`)

**Convention ของ drum `level`**: normalize ให้ตีเดี่ยวที่ vol 1.0 แล้ว peak ≈ 1.0 เท่ากันทุกเสียง
→ **ความสมดุลทางดนตรีเป็นหน้าที่ของ Mixer ไม่ใช่ TUNING** (แก้ปัญหาเดิมที่ความดังฝังปนอยู่ในสูตรสังเคราะห์เสียงจนจูนไม่ได้)

ค่า 303 ที่ใช้บ่อย:

| key | ค่า | คุมอะไร |
|---|---|---|
| gateRatio | 0.55 | โน้ตธรรมดาปิด gate ที่กี่ % ของ step ← **ตัวคุมความสะบัด** |
| decayMinS / decayRangeS | 0.03 / 1.6 | ช่วง filter-env decay |
| accentDecayS | 0.18 | ความยาว accent sweep |
| slideS | 0.055 | เวลา portamento |
| envModOct / accentOct | 4.0 / 2.4 | ความลึก env-mod / accent (octaves) |
| resoGain / accentReso | 5.6 / 1.2 | feedback ที่ reso=1 / เสริมตอน accent |
| fbHpHz | 180 | HP ใน resonance loop |
| tap3 / tap4 | 0.72 / 0.28 | สัดส่วน pole 3/4 (slope ~18dB) |
| driveGain / outGain | 6 / 0.9 | distortion / level ออก |

---

## 8.5) Reference patch สำหรับ A/B

deploy แล้วที่ **https://fckers00-cmd.github.io/RB303/** (GitHub Pages · https จริง → ได้ AudioWorklet ไม่ใช่ fallback)

**⚠️ ลิงก์ด้านล่างมาจาก build เก่า (ก่อน 809 rebuild)** — ค่า knob กลองจะไม่ตรงกับความหมายปัจจุบัน
(`sdDecay` เคยเป็นวินาที ตอนนี้เป็น 0-1 · `sdSnappy` เคยเป็น unipolar ตอนนี้ bipolar tom↔snare)
เก็บไว้เป็น**ตัวอย่าง pattern** ได้ แต่ **ห้ามใช้เทียบเสียง** — ต้องขอลิงก์ใหม่จากผู้ใช้ก่อนทุกครั้งที่จะ A/B

**เวลาจะแก้เสียง ให้ขอลิงก์ปัจจุบันจากผู้ใช้ก่อนเสมอ** แล้ว decode ดูว่าเขาหมุนอะไรไว้ —
ค่าที่ผู้ใช้ตั้งเองคือข้อมูลที่ดีที่สุดที่มี และเคยชี้บั๊กได้จริงมาแล้ว 2 ครั้ง

```
#p=eyJ2Ijo0LCJ0IjoxMzAsInciOjAsImsiOnsidHVuZSI6MCwiY3V0b2ZmIjo1MjYuNzUyNzkzNDY5NDk0OSwicmVzbyI6MC42MTI4ODE5NzgzNTI4NjQ1LCJlbnZNb2QiOjAuMzE3Njg1MTA2MDY1NTM4MjQsImRlY2F5IjowLjQsImFjY2VudCI6MC41LCJkcml2ZSI6MC4zNSwic2RQaXRjaCI6MjMzLjg4MzM5MDYwNTczNTQzLCJzZERlY2F5IjowLjEyMDM4MzU1MTA0NTYxMDI0LCJzZFNuYXBweSI6MC45NDE2NjY2MzI3NTgyNDY2LCJjcFBpdGNoIjoxMzY1LjU5MjU4MjkyNTU0NTUsImNwRGVjYXkiOjAuMDg1MDgyMjA3ODcwNTA2OCwiY3BTcHJlYWQiOjAuMDF9LCJsIjoxNiwicyI6W1szNiwxLDEsMF0sWzM2LDIsMCwwXSxbNDgsMSwwLDBdLFszNiwwLDAsMF0sWzM2LDEsMCwwXSxbMzksMSwxLDFdLFszNiwxLDAsMF0sWzM2LDAsMCwwXSxbNDYsMSwwLDBdLFszNiwxLDEsMF0sWzM2LDIsMCwwXSxbNDMsMSwwLDBdLFszNiwxLDAsMF0sWzM2LDAsMCwwXSxbMzksMSwxLDBdLFszNiwxLDAsMF1dLCJkIjp7IkJEIjoiMTAwMDEwMDAxMDAwMTAwMCIsIlNEIjoiMDAwMDAwMDAwMDAwMDAwMCIsIkNIIjoiMDAxMDAwMTAwMDEwMDAxMCIsIk9IIjoiMDAwMDAwMDAwMDAwMDAwMCIsIkNQIjoiMDAwMDEwMDAwMDAwMTAwMSJ9LCJtIjp7InYzMDMiOjAuNTUsInZCRCI6MC42NSwidlNEIjowLjQyLCJ2Q0giOjAuMzIsInZPSCI6MC4zMiwidkNQIjowLjQsInZNYXMiOjAuOX19
```

```
time  ● ○ ● — ● ● ● — ● ● ○ ● ● — ● ●
note  C2    C3    C2  D#2 C2    A#2 C2    G2  C2    D#2 C2
acc   A · · · · A · · · A · · · · A ·
slide · · · · · S · · · · · · · · · ·
BD    ● · · · ● · · · ● · · · ● · · ·
CH    · · ● · · · ● · · · ● · · · ● ·
CP    · · · · ● · · · · · · · ● · · ●
```

knob ที่ต่างจากค่าเริ่มต้น: cutoff 527 · reso 0.61 · envMod 0.32 · sdPitch 234 · sdDecay 0.12 · **sdSnappy 0.94** · cpPitch 1366 · cpDecay 0.085 · cpSpread 0.010 (ไม่แตะ)

## 9) Environment

- **`file://` และ iframe preview บล็อก AudioWorklet** → ได้ ScriptProcessor fallback เสมอในสองที่นั้น (ปกติ ไม่ใช่บั๊ก) · host บน https จริงถึงได้ worklet · แถบสถานะในแอปบอกอยู่
- fallback ตั้ง buffer 2048 + `latencyHint:'playback'`
- ผู้ใช้เข้า Claude ผ่าน web/mobile เท่านั้น ติดตั้ง Claude Desktop ที่ออฟฟิศไม่ได้ → มี Codex ที่เครื่องออฟฟิศสำหรับงานที่ต้องแตะไฟล์จริง

---

## 10) โปรโตคอลของ session

### เปิด session
1. อ่านไฟล์นี้ทั้งไฟล์ — โดยเฉพาะ **§6 (ตัวเลขที่วัดแล้ว)** · **§6.5 (ทางที่ไม่เวิร์ก)** · **§7 (ตัดสินไปแล้ว)**
2. ถ้าผู้ใช้แนบ `.html` มา → ทำงานกับไฟล์นั้น อย่าเขียนใหม่จากศูนย์
3. ถ้าจะแก้เสียง → **ขอลิงก์ปัจจุบันจากผู้ใช้ก่อน** แล้ว decode ดูค่าที่เขาตั้งเอง

### ปิด session
1. `bash test/run.sh` ต้องขึ้น `=== ผ่านทั้งหมด ===`
2. **อัปเดตไฟล์นี้**: ตัวเลขใหม่เข้า §6 · ทางที่ลองแล้วพังเข้า §6.5 · สิ่งที่ตัดสินเข้า §7
3. บอกรายการไฟล์ที่ต้องอัป GitHub + ชื่อที่ต้องใช้ (ไฟล์ใหญ่ให้อัปเป็น `v2.html` ก่อนทับ `index.html`)

### โครง repo
```
index.html          ← ตัวแอป (อัปเป็น v2.html ทดสอบก่อนทับ)
HANDOFF.md          ← ไฟล์นี้
README.md
test/  run.sh · smoke.js · ui_test.js · test_dsp.js · hash_test.js · bank_test.js
```

### ของที่อยู่ใน Project knowledge
- `HANDOFF.md` (ไฟล์นี้) — สถานะเทคนิค
- `index.html` — โค้ดจริง
- **Project instructions** — วิธีทำงาน กฎเหล็ก ข้อจำกัดของผู้ใช้

live: **https://fckers00-cmd.github.io/RB303/**
