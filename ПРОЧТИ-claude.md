# Пакет РЕВЕРСА: задача для Claude

Это разбор трендового ролика, сделанный РЕВЕРСОМ без нейросети. Посмотри все файлы пакета
(основа.mp4 / кадры, раскадровка.jpg, днк.json, фишка.txt, что-меняем.json, заготовка-шаблона.txt) и напиши
**один шаблон-промпт для Seedance 2.0 / 2.5**.

## Какой тип шаблона
- **«Поверх оригинала»** (по умолчанию, если в фишка.txt не сказано иное): видео-основа загружается в Seedance
  как @video1 и задаёт ВСЁ движение, камеру, тайминг и звук. Меняются только лицо, тело и волосы, одежда,
  место, товар — то, что включено в что-меняем.json. Формат и эталон — раздел «Тип А» ниже.
- **«С нуля»**: только если видео-основы нет. Формат и эталон — раздел «Тип Б» ниже.

## Тип А — «поверх оригинала»
Блоки строго в таком порядке:
CREATIVE MAPPING (@video1 и @image1…N — номера по порядку включённых пунктов: лицо, тело, место, товар) ·
ONE-SENTENCE SUMMARY · MOTION LOCK — ABSOLUTE (первый кадр = первый кадр основы поза в позу; все ключевые
моменты с таймкодами из днк.json; момент фишки помечен «THE GAG, cannot be skipped») · CAMERA LOCK ·
OBJECT LOCK (то, что нельзя менять, — из фишка.txt) · PERFORMER (REPLACE COMPLETELY / FACE / HAIR / BODY / OUTFIT) ·
LOCATION (если включено) · PRODUCT (если включено: какой предмет оригинала заменяет и его путь по кадру) ·
AUDIO · NEGATIVES.
Правила типа А:
1. Пиши «замки», а не описание сцены: движение не описывать художественно, только якорные моменты по времени.
2. Всегда REPLACE COMPLETELY и HAIR: модель любит оставлять волосы и фигуру исходного человека.
3. Одежду бери только из что-меняем.json; явно запрети одежду с фото героя.
4. Если в фишка.txt есть «Баги прошлой генерации» — каждый баг превращается в правило в нужном блоке + в NEGATIVES.

Эталон типа А (дал лучший результат на турнике):
```
CREATIVE MAPPING
@video1 = base video and authoritative reference for the entire performance: every body movement, rotation, timing, camera position, handheld shake, framing, bar and post geometry, performer scale, frame order, audio and duration.
@image1 = lead performer's facial identity only. Face and identity only — no background, lighting or pose transfer.
@image2 = lead performer's body build and hair only. Ignore the clothing in @image2. No background or pose transfer.
@image3 = environment only: ground, trees, buildings, sky and light. Do not take people or objects from it.
@image4 = the exact object that replaces the orange sunglasses: shape, proportions, materials, colour. No printed text.

---

ONE-SENTENCE SUMMARY
Edit the existing @video1 performance in one continuous take: the person from @image1/@image2 replaces the girl, the location from @image3 replaces the background around the unchanged low bar, and the object from @image4 replaces the orange sunglasses — it sits on the performer at the start and flies off at the exact moment the sunglasses fly off in @video1.

---

MOTION LOCK — ABSOLUTE
Frame 1 of the output equals frame 1 of @video1, pose for pose: standing behind the bar, both hands gripping it, mid-jump into the fold — copy the exact body position of the first source frame.
No standing intro, no delay, no extra beats at the start or end.
Preserve every movement of @video1 at its exact source time: the fold over the low bar, both rotations, the horizontal hold, the upside-down hang, the legs swinging over, the landing, the crouch under the bar, the hands going to the head, the sit-down on the grass. Same joint positions, hand grip on the bar, foot contacts, head angles, expressions, speed and momentum. Do not simplify, smooth, slow down or add any movement.

---

CAMERA LOCK
Preserve the source camera exactly: handheld vertical phone held by a friend, same position, height, angle, shake, jerks, framing, field of view, focus behaviour and motion blur in every frame. Performer occupies the same screen position and size as in the source. No new angles, reframing, zoom, stabilisation, slow motion or speed change. Same smartphone video texture as the source: mild noise, slight compression, natural phone colour — not cleaner, not cinematic.

---

BAR — ABSOLUTE LOCK, EVERY FRAME
The low metal bar and its painted posts from @video1 stay in every frame with identical geometry: same height (hip level of the performer), same position, same thickness, same spacing of the posts. Hands and body interact with the bar exactly as in the source and never pass through it. The bar may take the colour of the new location; its shape and position never change.

---

PERFORMER
FACE: apply @image1 identity to the visible face only. Keep the source expressions, mouth movement, laugh and grimace. When the face is upside down, blurred or turned away in the source, it stays that way — do not reveal or redraw it.
REPLACE COMPLETELY: no trace of the original performer remains — not her long blonde hair, not her body shape, not her skirt or top.
HAIR: exactly the hair from @image1/@image2 — short, same colour. Never long hair, never blonde, never flowing hair, even upside down and during rotations.
BODY: apply the build from @image2, fitted over the exact source body pose and silhouette.
OUTFIT: [ОДЕЖДА — например: fitted grey long-sleeve sports top, black athletic shorts, white sneakers]. Never a suit, jacket, tie or formal shoes unless written here. Same outfit in every frame, moving with the existing motion.

---

LOCATION
Replace everything around the bar with the environment from @image3, matched to the source camera perspective, horizon line and light direction. Keep the light of the source: soft overcast dusk, no hard shadows. Grass stays under the bar where the performer lands and sits. Nothing in the new environment covers the bar, the performer, the hands or the feet. Light breeze — leaves and grass move naturally.

---

PRODUCT — THE GAG
The object from @image4 replaces the orange sunglasses in every frame where the sunglasses are visible in @video1: worn by the performer at the start, flying off at the exact source moment, landing on the grass exactly where the sunglasses land. It must visibly leave the face during the rotations and fall to the grass — this is the gag and cannot be skipped. From 00:06.0 to the end it lies clearly visible on the grass in front of the performer, and the performer has nothing on the face. At 00:06.5 the performer grabs the head with both hands and laughs — exactly as in @video1. Same object, same size, same colour in every frame. No logos or text on it.

---

AUDIO
Preserve the original audio of @video1 unchanged and in exact sync. No added music, effects or voice.

---

NEGATIVES
No altered motion, no simplified or missing rotation, no changed bar height or position, no high gym bar, no fence, no reframing, no new camera angles, no stabilisation, no slow motion, no cuts, no retiming, no frozen frames, no extra or missing people, no duplicated limbs, no hands passing through the bar, no morphing face, no face drawn when hidden in the source, no product staying on the face after it flies off, no product missing from the grass at the end, no suit or formal clothing unless specified, no standing intro, no long hair, no blonde hair, no trace of the original performer, no clean cinematic render, no text, no logos, no watermarks, no captions, no UI elements.
```

## Тип Б — «с нуля»
### Цель
Не точная копия ролика, а **шаблон того же тренда**: тот же сюжет, ритм, камера, атмосфера
и, главное, та же **фишка** (фишка.txt — её написал человек, она важнее всего остального).
Персонажи, товар и место подставляются метками.

### Формат ответа — строго такой (эталон — в конце файла)
```
REFERENCES:
[ФОТО …] defines … Do not use its background.        ← одна строка на каждую метку

CORE SCENE:
<одно-два предложения: кто, где, что происходит и чем кончается>

GLOBAL:
Style: <жанр съёмки одной строкой>
Camera: <сколько кадров и какие склейки / или «one continuous handheld take»>
Light: …
Colour: …
Exclusions: …

TIMELINE:
[00:00-00:03] НАЗВАНИЕ БИТА
Cam: <план, угол, движение — одна строка>
Act: <одно ясное действие — одна-две строки>

[…] … (3–5 битов, каждый 2–3 сек)
сюда ляжет реклама: <пустая поверхность в кадре, финальный бит>

INVARIANT:
<метки не меняются, не сливаются, не меняются местами>
<поверхность под рекламу остаётся пустой, ровно освещённой>
No text anywhere in frame.
--ar <как в оригинале> --duration <секунды>s
```

### Правила
1. **Коротко.** Весь шаблон примерно 200–300 слов. Seedance теряется в длинных промптах:
   никаких отдельных строк про автоэкспозицию, rolling shutter, облака по секундам.
2. **3–5 битов по 2–3 секунды**, у каждого название КАПСОМ и одно главное действие.
   Не дроби на десятки моментов по 0,5 сек.
3. **Метки называй по смыслу тренда**: [ФОТО БОЙЦА 1], [ФОТО ГЕРОЯ], [ФОТО ТОВАРА], [ФОТО ЛОКАЦИИ].
   Только те, что нужны этому ролику.
4. **Сложное движение — через склейку.** Если в оригинале один дубль с трюком, который нейросеть
   не потянет, разбей его на 2–4 коротких плана с жёсткими склейками: каждый план простой.
5. **Фишка** — отдельным битом с понятным действием (что падает, кто бьёт, что слетает).
6. **Реклама** — не товар в руках, а пустая поверхность в кадре (щиты, вывеска, коробка, экран),
   в спокойном финальном бите, «flat and evenly lit, ready for a brand mark in post».
   Если в фишка.txt есть [ФОТО ТОВАРА] — товар участвует в сюжете.
7. **INVARIANT** всегда: персонажи не меняются, не сливаются и не меняются местами;
   место и свет одни и те же; нигде нет текста.
8. Exclusions всегда: no text, no letters, no logos, no watermarks, no signage + то, что
   часто ломается в этом жанре (руки, перчатки, лишние люди).
9. Под шаблоном 3 строки по-русски:
   - какие кадры из папки кадры/ загрузить в Seedance как раскадровку и какую строку дописать;
   - чего Seedance скорее всего не сможет и что упростить;
   - стоит ли вообще брать этот тренд (да / рискованно / нет).

### Как будет использоваться
Человек заменит метки на «the person from image 1», «the location from image 2» и т. д.,
загрузит свои фото и сгенерирует вручную в Seedance 2.0.

### Эталон типа Б (так выглядит хороший шаблон)
```
REFERENCES:
[ФОТО БОЙЦА 1] defines the first fighter's exact look: face, fur colour, build and gear. Do not use its background.
[ФОТО БОЙЦА 2] defines the second fighter's exact look: face, fur colour, build and gear. Do not use its background.
[ФОТО ЛОКАЦИИ] defines the arena only: ring, ropes, seating, depth and light sources. Do not take characters from it.

CORE SCENE:
Two small rodent boxers trade blows in a packed arena while a striped-shirt referee watches, until both go down and the referee counts.

GLOBAL:
Style: realistic live-action, cinematic arena lighting, shallow depth of field, fine film grain
Camera: four shots, hard cuts
Light: hard overhead spotlights on the ring, dark falloff toward the crowd, rim light on the fighters
Colour: warm ring canvas, deep shadows, red and blue accents from the gear
Exclusions: no text, no letters, no logos, no watermarks, no signage, no human faces, no warped limbs, no distorted gloves

TIMELINE:
[00:00-00:03] SQUARE UP
Cam: low ringside angle, wide, ropes crossing the foreground
Act: [ФОТО БОЙЦА 1] and [ФОТО БОЙЦА 2] circle each other, gloves up, tails counterbalancing, the referee stepping back

[00:03-00:06] EXCHANGE
Cam: medium, handheld, pushing in past the ropes
Act: a fast exchange of punches, sweat and spray in the spotlight, the crowd blurred in the dark behind

[00:06-00:08] THE FALL
Cam: fast whip pan following the last punch, then a hard drop to canvas level
Act: both fighters swing at once, connect, and go down together, gloves bouncing on the canvas

[00:08-00:10] THE COUNT
Cam: static low angle at canvas level, the ring apron and the barrier boards along the ring filling the background, flat and evenly lit and facing camera
Act: the referee stands between them, one arm raised, counting; the fighters lie still
сюда ляжет реклама: barrier boards around the ring, final shot

INVARIANT:
[ФОТО БОЙЦА 1] and [ФОТО БОЙЦА 2] keep identical faces, fur colour and gear in every shot — they never swap or merge.
[ФОТО ЛОКАЦИИ] stays unchanged, same arena and same light throughout.
The barrier boards around the ring stay completely blank and unmarked, flat and evenly lit, ready for a brand mark in post.
No text anywhere in frame.
--ar 16:9 --duration 10s
```
