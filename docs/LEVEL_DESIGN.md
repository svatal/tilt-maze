# Návrh 10 úrovní (tilt-maze)

Logický prostor **360×640**, kulička poloměr **11** (viz `constants.ts`). Validace: `levelGeometry.ts` (tvar úrovní, volný start/cíl), `levelSolvability.ts` (BFS s rezervou pro kuličku — **prokáže průchodnost, ne subjektivní obtížnost** na reálném telefonu).

## Progrese

| # | Název | Zaměření |
|---|--------|----------|
| 1 | Otevřená deska | Jen obvod; cíl v horní polovině, mimo roh a střed — naučí míření přes celou desku. |
| 2 | První přehrada | Jedna vnitřní zeď; objíždění překážky. |
| 3 | Dvojitá brána | Dvě zdi, nutnost plánovat smyčku. |
| 4 | Smyčka | Tři segmenty, delší trasa. |
| 5 | Bludiště | Párové zdi jako v původní „hádance“; maximální složitost **bez pastí**. |
| 6 | Opatrně kolem děr | První pasti + jednoduché zdi. |
| 7 | Zkouška rovnováhy | Více děr v průchodu mezi zdmi. |
| 8 | Past na úzké lince | Pasti u úzkých chodeb (střed startu). |
| 9 | Mistrovská kombinace | Hustší pasti + plné párové zdi. |
| 10 | Slalom bez vodítek | **Jen obvod a pasti** — slalom bez vnitřních zdí. |

## Omezení a neověřené

- BFS používá vzorkování segmentů a mřížku 6 px; extrémně těsné průchody v reálné fyzice Matter.js mohou být náročnější než v modelu.
- Obtížnost naklánění na konkrétním telefonu (kalibrace, citlivost) **nebyla** v této větvi testována — pouze geometrická průchodnost a E2E layout.
- E2E klávesnice na úrovni 1 ověřuje posun kuličky a Matter overlay, ne úplný doběh do cíle (otevřená deska vyžaduje jemnější řízení než cyklické šipky v headless Chrome).

## Hraní bez menu

Postup **úroveň 1 → 10** přes tlačítko po výhře (`GameScene`) nebo výběr v menu.
