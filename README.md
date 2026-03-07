# 📅 SalePlan — Plan Sal Zajęciowych

Aplikacja PWA do układania i zarządzania planem sal zajęciowych. Działa w całości w przeglądarce — **bez serwera, bez instalacji, bez zbierania danych**. Można ją zainstalować na komputerze lub telefonie jak aplikację natywną.

---

## ✨ Funkcje

### 🧙 Kreator nowego roku szkolnego (6 kroków)

| Krok | Opis |
|------|------|
| 1 — Szkoła | Nazwa, skrót, telefon, strona www + lista budynków z adresami |
| 2 — Rok szkolny | Rok szkolny i numery godzin lekcyjnych |
| 3 — Piętra i sale | Piętra, segmenty i numery sal — każde piętro przypisane do budynku |
| 4 — Klasy i grupy | Lista klas z podziałem na grupy, import z pliku `.txt` |
| 5 — Nauczyciele | Lista nauczycieli ze skrótami, import z pliku `.txt` |
| 6 — Przypisania | Domyślne przypisanie klas do sal dla każdego dnia tygodnia |

### 🏫 Obsługa wielu budynków
- Szkoła może mieć dowolną liczbę budynków (każdy z nazwą i adresem)
- Każde piętro/strefa przypisane do konkretnego budynku
- Nazwa budynku widoczna w nagłówkach tabeli i oknie edycji

### 👨‍🏫 Nauczyciele
- Lista z imieniem, nazwiskiem i **automatycznie generowanym skrótem**
  - Nazwisko jednoczłonowe: `Jan Kowalski` → `JKow`
  - Nazwisko dwuczłonowe: `Anna Nowak-Wiśniewska` → `ANoW`
- Skróty edytowalne ręcznie, automatyczna obsługa duplikatów (`JKow2`)
- **Import z pliku `.txt`** — format: `Imię Nazwisko` (jeden na linię)

### 🎓 Klasy i grupy
- Każda klasa może mieć wiele grup (np. `1A gr1`, `1A gr2`, `1A cała klasa`)
- **Import z pliku `.txt`** — format: `klasa;skrót;nazwa grupy`
  - Obsługuje `;` i `,` jako separator
  - Przykład całej klasy: `1A;1A;cała klasa`
  - Przykład grupy: `1A;1Agr1;gr1`

### 📋 Planowanie sal
- Interaktywna siatka: godziny lekcyjne × sale
- W każdej komórce: **nauczyciel** (lista rozwijalna), **klasa/grupa** (lista rozwijalna), **przedmiot**, **uwagi**
- Skrót nauczyciela i klasy widoczny bezpośrednio w komórce
- Kolorowe oznaczenie pięter i budynków w nagłówkach
- Data „Obowiązuje od" dla każdego dnia tygodnia
- Eksport do **PDF** (orientacja pozioma, czysty druk)

### 📁 Archiwum
- Każdy nowy rok szkolny automatycznie **archiwizuje poprzedni**
- Dostęp do starych planów, ich **przywracanie** i usuwanie

---

## 📲 PWA — instalacja jako aplikacja

SalePlan jest w pełni zgodny ze standardem **Progressive Web App**.

### Chrome / Edge (Windows, Android)
1. Otwórz aplikację w przeglądarce
2. Po chwili pojawi się baner **„Zainstaluj SalePlan"** — kliknij **Instaluj**
3. Lub: ikona instalacji w pasku adresu (⊕)

### Safari (iOS / macOS)
1. Otwórz aplikację w Safari
2. Stuknij **Udostępnij → Dodaj do ekranu głównego**

### Co zyskujesz po instalacji
- Uruchamia się bez paska adresu, jak aplikacja natywna
- **Działa w pełni offline** — Service Worker cache'uje wszystkie pliki
- Skrót na pulpicie / ekranie głównym
- Automatyczna aktualizacja przy kolejnym otwarciu online

---

## 🔒 Prywatność i dane

> **Aplikacja nie zbiera, nie wysyła ani nie przechowuje żadnych danych zewnętrznie.**

Wszystkie dane przechowywane lokalnie w `localStorage` przeglądarki. Jedyne zewnętrzne połączenie to pobranie czcionek z **Google Fonts** (tylko przy pierwszym uruchomieniu online — potem są cache'owane przez Service Worker).

---

## 🚀 Uruchomienie

### GitHub Pages (zalecane dla PWA)
1. Wgraj zawartość repozytorium na GitHub
2. **Settings → Pages → Deploy from branch → main → / (root)**
3. Dostępne pod: `https://krzjur-oss.github.io/Plan-sal/`

> ⚠️ PWA (Service Worker) wymaga **HTTPS** — GitHub Pages zapewnia to automatycznie.

### Lokalnie
Otwórz `index.html` w przeglądarce. Funkcje offline i instalacja PWA wymagają serwera HTTPS.

---

## 📖 Jak zacząć

1. Pierwsze uruchomienie → automatycznie otwiera się **kreator** (6 kroków)
2. Uzupełnij dane szkoły, budynki, piętra, klasy, nauczycieli i przypisania
3. Kliknij **„Zakończ i przejdź do planu"**
4. Klikaj komórki w tabeli — wybieraj nauczyciela i klasę z listy, wpisz przedmiot
5. Naciśnij **💾 Zapisz** — dane zostają w przeglądarce

**Nowy rok szkolny:** przycisk **＋ Nowy rok** → kreator → stary rok trafia do archiwum.

---

## ⌨️ Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| `Ctrl + Enter` | Zapisz wpis w oknie edycji |
| `Escape` | Zamknij okno edycji |

---

## 🗂 Struktura repozytorium

```
/
├── index.html       ← cała aplikacja
├── manifest.json    ← konfiguracja PWA
├── sw.js            ← Service Worker (cache offline)
├── icon-72.png
├── icon-96.png
├── icon-128.png
├── icon-144.png
├── icon-152.png
├── icon-192.png
├── icon-384.png
├── icon-512.png
└── README.md
```

---

## 🛠 Technologie

- Czysty HTML + CSS + JavaScript — **zero zewnętrznych zależności**
- Dane: `localStorage` przeglądarki
- Offline: Service Worker (Cache API)
- Czcionki: Google Fonts — Outfit + JetBrains Mono
- Standard: PWA (Web App Manifest + Service Worker)

---

## 📄 Licencja

Do użytku wewnętrznego szkoły.
