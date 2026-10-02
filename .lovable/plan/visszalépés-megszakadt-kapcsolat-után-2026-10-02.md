# Visszalépés megszakadt kapcsolat után

## Megoldás
- A főoldali csatlakozás elküldi a böngészőben már megőrzött szobajegyet is, ha van ilyen.
- A szerver a név és a titkos szobajegy együttes egyezésekor ugyanahhoz a játékoshoz enged vissza, akár a játék közben is.
- Azonos név érvényes szobajegy nélkül továbbra sem vehető át, így más nem tudja megszemélyesíteni a kiesett játékost.
- A normál új csatlakozás és a szobalétszám szabályai változatlanok maradnak.

## Ellenőrzés
- Automatikus próba igazolja a sikeres visszalépést és a névlopás elutasítását.
- Böngészőben kipróbálom a főoldalról történő visszatérést, majd ellenőrzöm a hibamentes összeállítást.

## Technikai részletek
- Nem készül új adatbázismező: a már meglévő, véletlen szobajegy és annak biztonságosan tárolt lenyomata azonosítja a játékost.
- Elveszett böngészőadatok esetén a név önmagában szándékosan nem elegendő a szerep átvételéhez.
