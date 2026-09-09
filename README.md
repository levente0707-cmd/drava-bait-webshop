# Dráva Bait webshop – adminos verzió

## Indítás Windows alatt
1. Telepítsd a Node.js LTS verziót.
2. Csomagold ki a ZIP-et.
3. Kattints duplán a `START_DRAVA_BAIT.bat` fájlra.
4. Nyisd meg: http://localhost:3000
5. Admin: http://localhost:3000/admin
6. Jelenlegi helyi admin jelszó: `zsombi`

## Termék hozzáadása
Az adminfelületen:
- Név
- Ár
- Kategória
- Címke
- Leírás
- Termékkép (PNG/JPG/WEBP, max. 6 MB)
- Mentés

A mentett termék automatikusan bekerül a webshop termékei közé. A termékek a `data/products.json` fájlban tárolódnak, a feltöltött képek a `public/assets` mappába kerülnek.

## Fontos
Ez továbbra is fejlesztői/teszt webshop. Éles indulás előtt szükséges többek között HTTPS, erős és biztonságosan kezelt admin-hitelesítés, valódi fizetési szolgáltató, számlázás, jogi tájékoztatók, adatvédelmi megfelelés, készletkezelés és szerveres biztonsági védelem.
