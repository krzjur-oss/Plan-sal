# 📅 SalePlan — Plan Sal Zajęciowych

Aplikacja PWA do układania i zarządzania planem sal zajęciowych. Działa w całości w przeglądarce — **bez serwera, bez instalacji, bez zbierania danych**. Można ją zainstalować na komputerze lub telefonie jak aplikację natywną.

🔗 **Demo:** https://krzjur-oss.github.io/Plan-sal/

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
- Szkoła może mieć dowolną liczbę budynków, każdy z nazwą i adresem
- Każde piętro/strefa przypisane do konkretnego budynku
- Nazwy budynków widoczne w scalonych nagłówkach tabeli

### 👨‍🏫 Nauczyciele
- Lista z imieniem, nazwiskiem i **automatycznie generowanym skrótem**
  - Nazwisko jednoczłonowe: `Jan Kowalski` → `JKow`
  - Nazwisko dwuczłonowe: `Anna Nowak-Wiśniewska` → `ANoW`
- Skróty edytowalne ręcznie, automatyczna obsługa duplikatów (`JKow2`)
- **Import z pliku `.txt`** — format: `Imię Nazwisko` (jeden na linię)
- **Dodawanie w locie** — bezpośrednio z okna edycji komórki, bez wchodzenia do kreatora

### 🎓 Klasy i grupy
- Każda klasa może mieć dowolną liczbę grup, np. `4A gr ez`, `4A WF gr1`, `4A cała klasa`
- Obsługa grup zajęć nieobowiązkowych i międzyklasowych
- **Import z pliku `.txt`** — format: `klasa;skrót;nazwa grupy`
  - Obsługuje `;` i `,` jako separator
  - Przykład całej klasy: `1A;1A;cała klasa`
  - Przykład grupy: `1A;1Agr1;gr1`, `4A;4Aez;gr ez`
- **Dodawanie w locie** — bezpośrednio z okna edycji komórki

### 📋 Planowanie sal
- Interaktywna siatka: godziny lekcyjne × sale
- W każdej komórce: **nauczyciel** (lista rozwijalna), **klasa/grupa** (lista rozwijalna), **przedmiot**, **uwagi**
- Skrót nauczyciela i klasy/grupy widoczny bezpośrednio w komórce
- Data „Obowiązuje od" dla każdego dnia tygodnia
- Eksport do **PDF** (orientacja pozioma, czysty druk)
- Tryb **jasny i ciemny** — przełącznik 🌙/☀️ w górnym pasku, wybór zapamiętywany

### 🗂 Scalony nagłówek tabeli
Nagłówek tabeli podzielony jest na do 5 wierszy z automatycznym scalaniem komórek:

| Wiersz | Zawartość | Kiedy widoczny |
|--------|-----------|----------------|
| 1 — Budynek | Scalony na wszystkie sale budynku | Tylko gdy ≥ 2 budynki |
| 2 — Piętro | Scalony na wszystkie sale piętra | Tylko gdy ≥ 2 piętra |
| 3 — Segment | Scalony na sale segmentu | Tylko gdy ≥ 2 segmenty |
| 4 — Sala | Numer i opis sali | Zawsze |
| 5 — Gospodarz | Klasa gospodarz + wychowawca | Zawsze |

### 🏠 Gospodarz sali
- Każdej sali można przypisać **klasę gospodarza** i **nauczyciela wychowawcę**
- Ustawienie przez kliknięcie wiersza „Gospod." w nagłówku tabeli
- Widoczny przez cały rok szkolny niezależnie od dnia tygodnia

### 📁 Archiwum
- Każdy nowy rok szkolny automatycznie archiwizuje poprzedni
- Dostęp do starych planów, ich przywracanie i usuwanie

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
- **Działa w pełni offline** — Service Worker cache'uje wszystkie pliki przy pierwszym uruchomieniu
- Skrót na pulpicie / ekranie głównym
- Automatyczna aktualizacja przy kolejnym otwarciu online

---

## 🔒 Prywatność i dane

> **Aplikacja nie zbiera, nie wysyła ani nie przechowuje żadnych danych zewnętrznie.**

Wszystkie dane przechowywane lokalnie w `localStorage` przeglądarki. Jedyne zewnętrzne połączenie to pobranie czcionek z **Google Fonts** (tylko przy pierwszym uruchomieniu online — potem cache'owane przez Service Worker).

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
2. Uzupełnij dane szkoły, budynki, piętra, klasy z grupami, nauczycieli i przypisania
3. Kliknij **„Zakończ i przejdź do planu"**
4. Kliknij wiersz **„Gospod."** w nagłówku tabeli aby ustawić klasę i wychowawcę każdej sali
5. Klikaj komórki w tabeli — wybieraj nauczyciela i klasę/grupę z listy, wpisz przedmiot
6. Przycisk **＋** pod listą w oknie edycji pozwala dodać nowego nauczyciela lub grupę w locie
7. Naciśnij **💾 Zapisz** — dane zostają w przeglądarce

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
