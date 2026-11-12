/**
 * Sdílené české texty ovládání a senzorů (menu + banner ve hře).
 */

export const SENSOR_WARNING_INNER_HTML = `
  <div style="margin-bottom:12px;font-size:1.05rem;font-weight:700">Senzory nepřijímají data</div>
  <p style="margin:0 0 10px;max-width:340px;line-height:1.45;font-size:0.9rem">
    Prohlížeč neposílá údaje o naklonění. Na <strong>Androidu v Brave</strong> zkontrolujte stránkové oprávnění
    <strong>Pohybové senzory</strong> (ikonka zámku v adresním řádku → oprávnění) a že
    <strong>Brave Shields</strong> neblokují senzory. V <strong>Chrome</strong> musí být stránka na <strong>HTTPS</strong>.
    Na iOS povolte přístup v dialogu. Můžete použít tlačítka <strong>Kalibrovat</strong> po položení telefonu rovně,
    nebo na počítači zapnout režim <strong>Myš</strong>.
  </p>
`;

export const SENSOR_DISMISS_BUTTON_LABEL = "Rozumím, použiju myš";

export type HelpSection = { id: string; title: string; bodyHtml: string };

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "play",
    title: "Jak hrát",
    bodyHtml: `
      <p>V hlavním menu vyberte jednu z <strong>15 úrovní</strong> (zdi, pasti, pak lokální sklon podlahy) a klepněte <strong>Hrát vybranou úroveň</strong>. Ve hře nakloňte telefon a doveďte světle žlutou kuličku do cílové díry se <strong>tmavě zeleným</strong> středem (okraj díry je tmavě hnědý, stejně jako u pastí).</p>
      <p><strong>Sklon podlahy</strong> je vidět jen jako <strong>odstín dřeva</strong>: tmavší místa jsou níž, světlejší výš. Rampa mezi nástupnicemi má plynulý přechod odstínu. Kulička necítí propad jako u pasti — jen mírný tah směrem dolů po spádu.</p>
      <p><strong>Pasti</strong> vypadají jako díry s velmi <strong>tmavým hnědočerným</strong> vnitřkem (na desce spíš černohnědé kruhy, ne barevně označené). Kuličku k nim nepřitahují „magicky“ ze dálky: u <strong>okraje</strong> díry působí místní sklon dovnitř (lze okrajem projet). Spadne-li <strong>střed kuličky</strong> do pasti, krátce „spadne“ a vrátí se na <strong>start úrovně</strong> (úroveň pokračuje). Stejným propadem do cíle úroveň vyhrajete.</p>
      <p>Na počítači zapněte ve hře tlačítko <strong>Myš</strong> (nebo klávesu <strong>M</strong>) a táhněte kurzor od středu herní plochy — směr a vzdálenost určují sklon desky. Tlačítko <strong>Menu</strong> vrátí do výběru úrovní.</p>
    `
  },
  {
    id: "mouse",
    title: "Ovládání myší",
    bodyHtml: `
      <ul style="margin:0;padding-left:1.1rem;line-height:1.45">
        <li><strong>Střed kruhu</strong> na herní ploše = rovina (žádný sklon).</li>
        <li><strong>Směr od středu</strong> = směr kutálení; <strong>vzdálenost</strong> = síla.</li>
        <li>Kurzor držte <strong>uvnitř tmavé herní plochy</strong> (ne v pruhu tlačítek).</li>
        <li><strong>Vypnutí:</strong> znovu Myš/M, <strong>Escape</strong>, přepnutí okna, nebo kurzor mimo plánku.</li>
        <li>Po zapnutí Myš se <strong>senzor naklonění vypne</strong> — nelze kombinovat. Po vypnutí Myš znovu platí telefon.</li>
      </ul>
    `
  },
  {
    id: "calibrate",
    title: "Kalibrace",
    bodyHtml: `
      <p>Ve hře klepněte na <strong>Kalibrovat</strong> s telefonem položeným rovně na stole — aktuální poloha se nastaví jako „nula“ pro naklonění.</p>
      <p>Kalibraci můžete opakovat kdykoliv během úrovně. Na počítači s režimem Myš slouží hlavně pro pozdější hru na telefonu ve stejné relaci.</p>
    `
  },
  {
    id: "sensors",
    title: "Senzory a oprávnění",
    bodyHtml: `
      <p>Test naklonění na Androidu vyžaduje <strong>HTTPS</strong> (Chrome). iOS zobrazí dialog po startu hry z menu — přístup povolte pouze pokud chcete ovládat nakloněním.</p>
      <p><strong>Brave (Android):</strong> pokud po ~1,5 s nejsou data ze senzorů, zkontrolujte stránkové oprávnění pohybových senzorů (zámek v adresním řádku) a vypněte <strong>Shields</strong> pro tuto stránku. Některé buildy Brave vracejí nulové údaje i při zapnutých senzorech.</p>
      <p>V tomto okně můžete zkontrolovat stav oprávnění tlačítky níže; systémový dialog se zobrazí jen po klepnutí na <strong>Požádat o přístup (iOS)</strong> nebo při startu úrovně na zařízení s iOS.</p>
    `
  }
];

export const DESKTOP_SENSOR_HINT_TEXT =
  "Na tomto zařízení zapněte Myš a táhněte kurzor od středu herní plochy. Podrobnosti v menu: Nápověda ovládání a senzorů.";
