/**
 * Sdílené české texty ovládání a senzorů (menu + banner ve hře).
 * Vychází z README a stávajících nápověd v GameScene — bez vymyšlených štítků v nastavení prohlížeče.
 */

export const SENSOR_WARNING_INNER_HTML = `
  <div style="margin-bottom:12px;font-size:1.05rem;font-weight:700">Senzory nepřijímají data</div>
  <p style="margin:0 0 10px;max-width:340px;line-height:1.45;font-size:0.9rem">
    Prohlížeč neposílá údaje o naklonění. Na <strong>Androidu v Brave</strong> zkontrolujte stránkové oprávnění
    <strong>Pohybové senzory</strong> (ikonka zámku v adresním řádku → oprávnění) a že
    <strong>Brave Shields</strong> neblokují senzory. V <strong>Chrome</strong> musí být stránka na <strong>HTTPS</strong>.
    Na iOS povolte přístup v dialogu. Můžete použít tlačítka <strong>Kalibrovat</strong> po položení telefonu rovně.
  </p>
`;

export const SENSOR_DISMISS_BUTTON_LABEL = "Rozumím, použiju klávesnici";

export type HelpSection = { id: string; title: string; bodyHtml: string };

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "play",
    title: "Jak hrát",
    bodyHtml: `
      <p>Nakloňte telefon a doveďte kuličku do zelené cílové díry. Vyhněte se červeným pastem — kulička se vrátí na start.</p>
      <p>Na počítači použijte <strong>šipky</strong> nebo <strong>WASD</strong>.</p>
    `
  },
  {
    id: "calibrate",
    title: "Kalibrace",
    bodyHtml: `
      <p>Ve hře klepněte na <strong>Kalibrovat</strong> s telefonem položeným rovně na stole — aktuální poloha se nastaví jako „nula“ pro naklonění.</p>
      <p>Kalibraci můžete opakovat kdykoliv během úrovně.</p>
    `
  },
  {
    id: "sensors",
    title: "Senzory a oprávnění",
    bodyHtml: `
      <p>Test naklonění na Androidu vyžaduje <strong>HTTPS</strong> (Chrome). iOS zobrazí dialog po klepnutí na hru — přístup povolte pouze pokud chcete ovládat nakloněním.</p>
      <p><strong>Brave (Android):</strong> pokud po ~1,5 s nejsou data ze senzorů, zkontrolujte stránkové oprávnění pohybových senzorů (zámek v adresním řádku) a vypněte <strong>Shields</strong> pro tuto stránku. Některé buildy Brave vracejí nulové údaje i při zapnutých senzorech.</p>
      <p>Oprávnění se v aplikaci žádá <strong>pouze po vašem klepnutí</strong> (start úrovně nebo tlačítko níže), nikdy automaticky.</p>
    `
  }
];

export const DESKTOP_SENSOR_HINT_TEXT = "Na tomto zařízení ovládej šipkami nebo WASD.";
