# RB-303 → Acid Box · HANDOFF

เอกสารส่งต่องานสำหรับเซสชันถัดไป — โค้ดจริงทั้งหมดอยู่ใน `rb303.html` ไฟล์เดียวจบ

---

## 1) เป้าหมายที่ล็อกไว้

ผู้ใช้ = product/direction · Claude = software engineer ที่ลงมือทำจริง
เป้าหมายหลักคือ **เรียนรู้ DSP** และเล่นได้จริงบนมือถือ ไม่ใช่ทำ product ขาย

Target: **"acid box จอเดียว"** = 303 หนึ่งตัว + กลอง 5 เสียง + Delay + Mute ต่อแทร็ค

ตัดออกโดยเจตนา (YAGNI — ของที่สร้างแล้วไม่ใช้คือภาระติดลบ): 303 ตัวที่สอง, เครื่องกลองตัวที่สอง (โดยเฉพาะ 909 ที่ hi-hat จริงเล่นจาก sample ROM), song mode, pattern banks (I/II/III/IV, A/B บนแผ่น Roland), compressor, PCF, pan, velocity, triplet mode

หลักที่ใช้ตลอด: **"ออกแบบเผื่อ ไม่สร้างเผื่อ"** — Engine เป็น class แยกต่อ voice, ctl interface กลาง, knob set แยกต่อแทร็ค → เติมทีหลังได้โดยไม่รื้อ

### วิธีทำงานที่ตกลงกันแล้ว

- **วัดก่อนเชื่อ** — ทุกข้อสรุปเรื่องเสียงต้องมีตัวเลข ไม่ใช่ความรู้สึกหรือกฎที่ท่องมา
- **ทำทีละอย่าง** ให้ผู้ใช้ฟังก่อนค่อยไปต่อ — เคยพลาดเพราะรวบหลายเรื่องมาส่งทีเดียวจนวิจารณ์ไม่ได้
- **อย่าขยับเป้าให้ตรงลูกศร** — เคยแก้ค่า TUNING เพื่อให้เทสต์ที่เขียนเองผ่าน ซึ่งผิด
- ผู้ใช้ชอบภาษาตรงไปตรงมา ไม่ต้องเชียร์ · ให้ทักท้วงเมื่อไม่เห็นด้วย

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

### UI
- Track selector `[303·BD·SD·CH·OH·CP]` — เปลี่ยนทั้ง step grid **และ panel Voice** พร้อมกัน (จงใจไม่ทำแท็บแยก ดู §7)
- ปุ่ม `[PITCH | TIME]` + Length (โผล่เฉพาะแทร็ค 303)
- **Mixer** fader ต่อ voice 6 ตัว + master — อยู่ **ท้ายสุด** ของหน้า (เป็นของตั้งแล้วทิ้ง ไม่ควรคั่นกลาง)
- ปุ่ม **Clr** ต่อแทร็ค + undo ในตัวปุ่ม 5 วินาที (ไม่มี confirm dialog โดยเจตนา — ล้างกริดเป็นงานที่ทำบ่อยตอนกรอกแผ่นใหม่)
- Scope: waveform + spectrum log 40Hz–12kHz

### Save/Share
URL hash `#p=` + base64(JSON) อัตโนมัติ (debounce 250ms, `history.replaceState`)

---

## 3) สถาปัตยกรรม (ต้องรู้ก่อนแก้)

- DSP core อยู่ระหว่าง `/* ==== DSP CORE BEGIN ==== */` … `/* ==== DSP CORE END ==== */` — เทสต์ extract ส่วนนี้ไปรันใน Node
- `WORKLET_CODE` ประกอบจาก `JSON.stringify(TUNING)` + `tanh/midiToFreq/polyblep/DrumKick/DrumSnare/DrumClap/DrumHat/Engine` (`.toString()`) + Voice303 wrapper
  → **เพิ่มคลาส/ฟังก์ชันใหม่ใน core ต้องเพิ่มเข้า list นี้ด้วย ไม่งั้น worklet พังแต่ fallback ยังทำงาน = บั๊กหายาก**
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
| 303 + กลอง 5 เสียงเต็มที่ | **~8% CPU** peak 0.87 RMS 0.40 NaN 0 |
| **หยุดเล่น เงียบสนิท** | **ยังกิน 8.3% CPU** ← ปัญหา ดู §7 |

### ความแรงของ knob กลอง (วัดจาก spectral centroid / ความยาวหาง)
| ปุ่ม | ผลจากปลายถึงปลาย |
|---|---|
| SD Pitch | 8.9 semitone |
| SD Decay | หางยาวขึ้น 6.4 เท่า |
| SD Snappy | 26 semitone |
| CP Pitch | 11.6 semitone |
| CP Decay | หางยาวขึ้น 5.5 เท่า |
| CP Spread | เปลี่ยน**จังหวะ** ไม่ใช่ความถี่ — วัดด้วย centroid ไม่เห็น ต้องดู envelope |

> **บทเรียนสำคัญ**: SD Pitch เคยตายสนิท (0.2 semitone) เพราะไปแตะแค่ body ซึ่งถูก noise กลบหมด
> แก้โดยให้ pitch ลาก noise bandpass ไปด้วย — **ปุ่มที่ดีต้องขยับหลายพารามิเตอร์พร้อมกัน ไม่ใช่ค่าเดียว**
> เทสต์ knob sweep เดิม (เช็ค NaN + peak) **ผ่านฉลุยทั้งที่ปุ่มตาย** → ต้องวัด "เสียงเปลี่ยนกี่ semitone" ด้วย

### ผลตรวจกับสเปกภายนอก (ผู้ใช้เอาสเปก groovebox จากที่อื่นมาเทียบ)
| ข้อ | ผล |
|---|---|
| Snap 0↔1 ดังต่างไม่เกิน 2-3 dB | **ตก — 3.7 dB และแกว่งไม่เป็นเส้น** (0%=-14.0 · 50%=-17.6 · 100%=-15.4 dB) |
| choke ต้อง 5–18ms ไม่งั้น click | **ผ่านแม้ใช้ 2ms** — ความชันตอน choke 0.278 < ตอนเล่นปกติ 0.631 → ไม่ต้องแก้ |
| ห้าม reset noise seed ทุก hit | ผ่านอยู่แล้ว (noise เดินต่อเนื่อง ไม่ reset ใน `trigger`) |
| deactivate voice ต่ำกว่า -72dB | **ตก — ยังไม่ทำ** |

> สเปกนั้นมีบั๊ก: `fastSoftClip` clamp ที่ ±1.5 แต่อนุพันธ์ `1-x²` เป็นศูนย์ที่ x=1 → เลยไปคือพับกลับ
> (input 1.0 → 0.667 แต่ input 1.5 → 0.375) นั่นคือ wavefolder ไม่ใช่ soft clip · ถ้าจะใช้ต้อง clamp ±1.0

---

## 7) คิวงาน

### ถัดไป (ตกลงกันแล้ว รอลงมือ)
1. **Voice deactivation** ต่ำกว่า -72dB — คืน CPU 8.3% ที่ทิ้งเปล่า (~10 บรรทัด)
2. **อัปเกรด Snappy เป็น macro จริง** — noise gain + brightness + noise decay + ลด body + **ชดเชยระดับให้ไม่แกว่ง** (แก้ปุ่มที่มีอยู่ ไม่เพิ่มปุ่มใหม่)

### หลังจากนั้น
3. **Delay** — ตกลงแล้วว่า **insert บน 303** (ไม่ใช่ master เพราะ kick เข้า feedback loop จะกองเป็นโคลน) · **ใส่ one-pole LP ใน feedback loop** (เสียงย้ำทึบลงเรื่อยๆ แบบ dub) · **sync กับ clock แล้วปล่อยให้กระโดดตอนเปลี่ยน BPM**
   → เขียนเป็นคลาสรับ sample เข้า/คืน sample ออก **ไม่ผูกกับ 303** เผื่ออัปเป็น send bus ทีหลัง
   → จอง `Float32Array` ใน constructor ขนาด max delay (ห้าม allocate ใน loop)
4. **Mute ต่อแทร็ค** — gain 0/1 ต่อ voice ก่อน sum

### รอหูผู้ใช้ตัดสิน (อย่าเดาแทน)
- Snappy กับ Spread ใช้จริงมั้ย → คำตอบจะบอกว่า BD/CH/OH ควรได้ปุ่มอะไร
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

## 9) Environment

- **`file://` และ iframe preview บล็อก AudioWorklet** → ได้ ScriptProcessor fallback เสมอในสองที่นั้น (ปกติ ไม่ใช่บั๊ก) · host บน https จริงถึงได้ worklet · แถบสถานะในแอปบอกอยู่
- fallback ตั้ง buffer 2048 + `latencyHint:'playback'`
- ผู้ใช้เข้า Claude ผ่าน web/mobile เท่านั้น ติดตั้ง Claude Desktop ที่ออฟฟิศไม่ได้ → มี Codex ที่เครื่องออฟฟิศสำหรับงานที่ต้องแตะไฟล์จริง

---

## 10) เริ่มเซสชันใหม่ยังไง

แนบ `rb303.html` + `HANDOFF.md` แล้วสั่งเช่น
*"อ่าน HANDOFF.md แล้วทำข้อ 1-2 ในคิว §7"*

**ก่อนส่งงานทุกครั้ง: `bash test/run.sh`**
