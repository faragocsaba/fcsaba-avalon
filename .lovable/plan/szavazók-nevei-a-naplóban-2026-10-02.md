# Szavazók nevei a naplóban

## Módosítás
- A lezárt szavazás naplóbejegyzésében az igenek és nemek száma mellett felsoroljuk az érintett játékosokat.
- A sorrend a játékoslista sorrendjét követi, így a bejegyzés kiszámítható és könnyen olvasható marad.
- Az elfogadva/elutasítva eredmény változatlanul a sor végén marad.

## Ellenőrzés
- Automatikus szabályteszt ellenőrzi a teljes magyar mondatot vegyes szavazatokkal.
- Lefuttatjuk az Avalon motor tesztjeit, majd ellenőrizzük, hogy az alkalmazás hibamentesen elkészül.

## Technikai részletek
- A módosítás kizárólag a szerveroldalon előállított, minden játékos számára látható naplószöveget érinti; a szavazási szabályok nem változnak.
