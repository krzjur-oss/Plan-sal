# 📅 SalePlan — Plan Sal Zajęciowych

Aplikacja PWA do układania i zarządzania planem sal zajęciowych. Działa w całości w przeglądarce — **bez serwera, bez instalacji, bez zbierania danych**. Można ją zainstalować na komputerze lub tablecie jak aplikację natywną.

🔗 **Aplikacja:** https://krzjur-oss.github.io/Plan-sal/

---

## ✨ Funkcje

### 🚀 Strona powitalna

Przy pierwszym uruchomieniu (lub gdy brak zapisanego planu) wyświetla się strona powitalna z czterema opcjami:

| Opcja | Opis |
|-------|------|
| ✨ Utwórz nowy plan | Kreator od zera — 6 kroków |
| 📋 Nowy rok szkolny | Kopiuje całą konfigurację z bieżącego roku (szkoła, sale, nauczyciele, klasy, plan) |
| 📂 Importuj z pliku | Wczytaj plan z pliku `.json` z wyborem trybu: zastąp / scal / nowy |
| 🎬 Wersja demo | Fikcyjna szkoła SP1 z przykładowym planem i demonstracyjną kolizją — dane nie są zapisywane |

---

### 🧙 Kreator nowego roku szkolnego (6 kroków)

| Krok | Opis |
|------|------|
| 1 — Szkoła | Nazwa, skrót, telefon, strona www + lista budynków z adresami |
| 2 — Rok szkolny | Rok szkolny i numery godzin lekcyjnych |
| 3 — Piętra i sale | Piętra, segmenty i numery sal — każde piętro przypisane do budynku |
| 4 — Klasy i grupy | Lista klas z podziałem na grupy, import z pliku `.txt` |
| 5 — Nauczyciele | Lista nauczycieli ze skrótami, import z pliku `.txt` |
| 6 — Przypisania | Domyślne przypisanie klas do sal dla każdego dnia tygodnia |

Panel instrukcji po lewej stronie kreatora wyjaśnia każdy krok.

#### 💾 Autosave szkicu kreatora
Kreator automatycznie zapisuje postęp co 30 sekund do `localStorage` (`sp_wiz_draft`). Przy przypadkowym zamknięciu — po ponownym otwarciu kreatora pojawi się pytanie o wznowienie przerwanej sesji.

#### ✏️ Edycja bieżącego roku
Przycisk **✏️ Edytuj rok** w górnym pasku otwiera kreator z danymi bieżącego roku. Można zmienić sale, klasy, nauczycieli lub godziny bez tworzenia nowego roku i bez utraty wpisanych zajęć.

---

### 🏫 Obsługa wielu budynków
- Dowolna liczba budynków z nazwą i adresem
- Każde piętro przypisane do konkretnego budynku
- Nazwy budynków widoczne w scalonych nagłówkach tabeli

---

### 👨‍🏫 Nauczyciele
- Automatycznie generowany skrót: `Jan Kowalski` → `JKow`, `Anna Nowak-Wiśniewska` → `ANoW`
- Skróty edytowalne ręcznie, obsługa duplikatów (`JKow2`)
- **Import z pliku `.txt`** — format: `Imię Nazwisko` (jeden na linię)
- **Dodawanie w locie** — bezpośrednio z okna edycji komórki
- Lista nauczycieli **sortowana alfabetycznie** po nazwisku

---

### 🎓 Klasy i grupy
- Każda klasa może mieć dowolną liczbę grup, np. `4A gr ez`, `4A WF gr1`
- **Import z pliku `.txt`** — format: `klasa;skrót;nazwa grupy`
- **Dodawanie w locie** — bezpośrednio z okna edycji komórki
- **Automatyczny skrót** klasy/grupy generowany na bieżąco (edytowalny ręcznie)
- Lista klas **sortowana alfabetycznie** z naturalnym porządkiem: `1A → 1B → 2A → 10C`

---

### 📋 Planowanie sal
- Interaktywna siatka: godziny lekcyjne × sale
- W każdej komórce: nauczyciel (lista), klasy/grupy (chipy), przedmiot, uwagi
- Skrót nauczyciela i badge klasy widoczne w komórce
- Data „Obowiązuje od" dla każdego dnia tygodnia

#### 👥 Zajęcia międzyoddziałowe
- Jedna sala — wiele klas/grup jednocześnie (np. `1A gr.1` + `2A gr.1`)
- Klasy dodawane jako chipy (＋ / ✕)

---

### ⚠ Wykrywanie kolizji
- Automatyczne wykrywanie gdy ten sam nauczyciel lub klasa jest w dwóch salach jednocześnie
- Komórka z kolizją: czerwona ramka + ikona ⚠ z tooltipem
- Licznik kolizji w dolnym pasku — kliknięcie przewija do pierwszej

---

### 🗂 Scalony nagłówek tabeli

| Wiersz | Zawartość | Kiedy widoczny |
|--------|-----------|----------------|
| Budynek | Scalony na wszystkie sale budynku | Gdy ≥ 2 budynki |
| Piętro | Scalony na wszystkie sale piętra | Gdy ≥ 2 piętra |
| Segment | Scalony na sale segmentu | Gdy ≥ 2 segmenty |
| Sala | Numer i opis sali | Zawsze |
| Gospodarz | Klasa gospodarz + wychowawca | Zawsze |

---

### 🏠 Gospodarz sali
- Każdej sali można przypisać klasę gospodarza i nauczyciela wychowawcę
- **Podwójny gospodarz** — dla sal dzielonych przez dwie klasy można przypisać dwie pary klasa+wychowawca; obie widoczne w nagłówku tabeli oddzielone poziomą linią
- Kliknięcie wiersza „Gospod." w nagłówku → modal z opcją dodania drugiego gospodarza
- Widoczny przez cały rok niezależnie od dnia

---

### 📁 Archiwum
- Każdy nowy rok automatycznie archiwizuje poprzedni
- Dostęp, przywracanie i usuwanie starych planów

---

### 🔄 Eksport i import JSON (współpraca)

#### Eksport
Przycisk **⬆ JSON** w górnym pasku. Plik `NazwaSzkoły_RRRR-MM-DD.json` zawiera konfigurację szkoły, plan, daty i archiwum.

#### Import
Przycisk **⬇ Import** lub **drag & drop** (przeciągnij plik `.json` na okno aplikacji).

Przy imporcie wyświetla się podgląd różnic i wybór trybu:

| Tryb | Działanie |
|------|-----------|
| Scalaj | Dodaje tylko brakujące wpisy — nie nadpisuje istniejących |
| Zastąp | Nadpisuje cały plan danymi z pliku |

#### Współpraca dwóch osób
Gdy dwie osoby układają plan dla różnych grup:
1. Każda eksportuje swój plik JSON
2. Jedna wczytuje plik drugiej i wybiera **Scal** — brakujące komórki zostają uzupełnione bez nadpisywania własnych wpisów

Import dostępny też ze **strony powitalnej** (karta „Importuj z pliku") z tym samym wyborem trybu.

---

### 📄 Eksport do PDF
Przycisk **⬇ PDF** — orientacja pozioma, gotowy do wydruku lub wysłania.

Wydruk zawiera **nagłówek** z:
- Nazwą szkoły (pełna + skrót)
- Rokiem szkolnym
- Dniem tygodnia
- Datą obowiązywania planu (pole „Od:")

---

### 🌙 Motyw jasny / ciemny
Przełącznik 🌙 / ☀️ w górnym pasku, zapamiętywany w `localStorage`.

### ❓ Panel pomocy
Przycisk **?** w prawym rogu — wysuwa panel z opisem funkcji.

---

## 📲 PWA — instalacja jako aplikacja

### Chrome / Edge (Windows, Android)
1. Otwórz aplikację
2. Kliknij baner **„Zainstaluj SalePlan"** lub ikonę ⊕ w pasku adresu

### Safari (iOS / macOS)
Stuknij **Udostępnij → Dodaj do ekranu głównego**

### Po instalacji
- Działa bez paska adresu, jak aplikacja natywna
- **Pełny tryb offline** — Service Worker cache'uje wszystkie pliki
- Skrót na pulpicie / ekranie głównym

---

## ⌨️ Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| `Ctrl + Enter` | Zapisz wpis w oknie edycji |
| `Escape` | Zamknij okno edycji |

---

## 🚀 Uruchomienie

### GitHub Pages (zalecane)
1. Wgraj pliki na GitHub
2. **Settings → Pages → Deploy from branch → main → / (root)**
3. Dostępne pod: `https://krzjur-oss.github.io/Plan-sal/`

> ⚠️ Service Worker wymaga **HTTPS** — GitHub Pages zapewnia to automatycznie.

> 💡 Po aktualizacji plików wyczyść dane witryny lub otwórz w trybie incognito, żeby stary Service Worker nie serwował poprzedniej wersji.

### Lokalnie
Otwórz `index.html` w przeglądarce. Offline i PWA wymagają HTTPS.

---

## 📖 Jak zacząć

1. Pierwsze uruchomienie → **strona powitalna**
2. Wybierz **Utwórz nowy plan** → kreator (6 kroków)
3. Wypełnij dane szkoły, budynki, piętra, klasy, nauczycieli i przypisania
4. Kliknij **„Zakończ i przejdź do planu"**
5. Kliknij wiersz **„Gospod."** — ustaw klasę i wychowawcę każdej sali (opcjonalnie drugi gospodarz)
6. Klikaj komórki w tabeli — wybierz nauczyciela, klasy, wpisz przedmiot
7. **💾 Zapisz**

**Nowy rok:** strona powitalna → **Nowy rok szkolny** (lub przycisk **＋ Nowy rok** w pasku) → stary rok trafia do archiwum.

**Edycja konfiguracji:** przycisk **✏️ Edytuj rok** → zmień sale, klasy lub godziny bez utraty wpisów.

---

## 🔒 Prywatność i dane

> Aplikacja nie zbiera, nie wysyła ani nie przechowuje żadnych danych zewnętrznie.

Wszystkie dane w `localStorage` przeglądarki. Jedyne zewnętrzne połączenie: czcionki Google Fonts przy pierwszym uruchomieniu online.

---

## 🗂 Struktura repozytorium

```
/
├── index.html       ← cała aplikacja (HTML + CSS + JS)
├── manifest.json    ← konfiguracja PWA
├── sw.js            ← Service Worker (cache offline)
├── icon-72.png  ... icon-512.png
└── README.md
```

---

## 🛠 Technologie

- Czysty HTML + CSS + JavaScript — zero zewnętrznych zależności
- Dane: `localStorage`
- Offline: Service Worker (Cache API)
- Standard: PWA (Web App Manifest + Service Worker)

---

## 📄 Licencja

Do użytku wewnętrznego szkoły.
