# 📅 SalePlan — Plan Sal Zajęciowych

Aplikacja PWA do układania i zarządzania planem sal zajęciowych. Działa w całości w przeglądarce — **bez serwera, bez instalacji, bez zbierania danych**. Można ją zainstalować na komputerze lub tablecie jak aplikację natywną.

🔗 **Aplikacja:** https://krzjur-oss.github.io/Plan-sal/

---

## 📦 Wersja

| | |
|---|---|
| **Aktualna wersja** | v1.1.0 |
| **Ostatnia aktualizacja** | 31 marca 2026 |
| **Status** | Aktywny, rozwijany |

---

## ✨ Funkcje

### 🚀 Strona powitalna

Przy pierwszym uruchomieniu wyświetla się strona powitalna z czterema opcjami:

| Opcja | Opis |
|-------|------|
| ✨ Utwórz nowy plan | Kreator od zera — 6 kroków |
| 📋 Nowy rok szkolny | Kopiuje całą konfigurację z bieżącego roku |
| 📂 Importuj z pliku | Wczytaj plan z pliku `.json` |
| 🎬 Wersja demo | Fikcyjna szkoła z przykładowym planem — dane nie są zapisywane |

---

### ☰ Menu nawigacyjne

Wszystkie opcje dostępne są przez przycisk **☰** w lewym górnym rogu. Menu wysuwa się jako panel boczny i zawiera:

| Pozycja | Opis |
|---------|------|
| Obowiązuje od | Data obowiązywania planu (osobna dla każdego dnia) |
| 💾 Zapisz | Ręczny zapis do pamięci przeglądarki |
| ⬇ Eksportuj PDF | Plan gotowy do wydruku (orientacja pozioma) |
| ⬆ Eksportuj JSON | Kopia zapasowa całego planu z archiwum |
| ⬇ Importuj JSON | Wczytaj plan z pliku `.json` |
| ✏️ Edytuj rok | Zmień sale, klasy, nauczycieli lub godziny |
| 🗑 Wyczyść dzień | Usuwa wszystkie wpisy bieżącego dnia |
| ❓ Pomoc | Panel z podpowiedziami |
| 🌙 Zmień motyw | Przełącz jasny / ciemny motyw |
| 🏠 Strona główna | Wróć do ekranu startowego |

---

### 🧙 Kreator nowego roku szkolnego (6 kroków)

| Krok | Opis |
|------|------|
| 1 — Szkoła | Nazwa, skrót, telefon, strona www + lista budynków |
| 2 — Rok szkolny | Rok szkolny i numery godzin lekcyjnych |
| 3 — Piętra i sale | Piętra, segmenty i numery sal |
| 4 — Klasy i grupy | Lista klas z podziałem na grupy |
| 5 — Nauczyciele | Lista nauczycieli ze skrótami |
| 6 — Przypisania | Domyślne przypisanie klas do sal |

Kreator automatycznie zapisuje postęp (autosave co 30 s). Menu ☰ → **✏️ Edytuj rok** otwiera kreator z danymi bieżącego roku bez utraty wpisanych zajęć.

---

### 🏫 Obsługa wielu budynków
Dowolna liczba budynków z nazwą i adresem. Każde piętro przypisane do budynku. Nazwy budynków widoczne w scalonych nagłówkach tabeli.

---

### 🎓 Klasy i grupy
- Klasy z opcjonalnym podziałem na grupy
- Kilka klas tego samego poziomu i grupy **automatycznie scala się** w komórce: `4A MN + 4B MN + 4C MN → 4ABC MN`
- Grupy różnych klas lub różnych poziomów pozostają osobno

---

### 📋 Planowanie sal
- Kliknij komórkę aby edytować zajęcia — wybierz nauczyciela, klasę/grupę i wpisz przedmiot
- Skróty klasy, przedmiotu i inicjały nauczyciela widoczne bezpośrednio w komórce
- **Ctrl+Enter** — zapisz wpis · **Esc** — zamknij okno

---

### 🖱️ Przeciąganie zajęć
- Przeciągnij wypełnioną komórkę na inną godzinę lub salę — kopiuje wpis
- Aby przenieść: przeciągnij + wyczyść oryginał
- Gdy cel jest zajęty — pojawi się pytanie przed nadpisaniem

---

### ⚠ Wykrywanie kolizji
- Czerwona ramka + ⚠ gdy ten sam nauczyciel lub klasa w dwóch salach jednocześnie
- Licznik kolizji w dolnym pasku — kliknij aby przejść do pierwszej

---

### 🏠 Gospodarz sali
- Kliknij wiersz **Gospod.** w nagłówku sali
- Przypisz klasę i wychowawcę (opcjonalnie dwóch dla sal dzielonych)

---

### 📁 Archiwum
- Kliknij rok w topbarze (np. **2025/2026 ▼**) aby otworzyć archiwum
- Można przywrócić lub trwale usunąć stary rok

---

### 🔄 Eksport i import JSON
- Menu ☰ → **⬆ Eksportuj JSON** — plik z pełnym planem i archiwum
- Menu ☰ → **⬇ Importuj JSON** lub przeciągnij plik `.json` na okno
- Tryby: **Scal** (uzupełnij braki) / **Zastąp** (nadpisz wszystko)

---

### 📄 Eksport do PDF
- Menu ☰ → **⬇ Eksportuj PDF** — orientacja pozioma, gotowy do wydruku
- Nagłówek zawiera nazwę szkoły, rok, dzień i datę obowiązywania

---

## 📲 PWA — instalacja jako aplikacja

### Chrome / Edge (Windows, Android)
Kliknij baner „Zainstaluj SalePlan" lub ikonę ⊕ w pasku adresu przeglądarki.

### Safari (iOS / macOS)
Udostępnij → **Dodaj do ekranu głównego**

### Po instalacji
- Pełny tryb offline — Service Worker cache'uje wszystkie pliki
- Przy nowej wersji aplikacja automatycznie się odświeży

---

## ⌨️ Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| **Ctrl+Enter** | Zapisz wpis w oknie edycji |
| **Escape** | Zamknij okno / panel / menu |

---

## 🚀 Uruchomienie

### GitHub Pages
https://krzjur-oss.github.io/Plan-sal/

### Lokalnie
Otwórz `index.html` bezpośrednio w przeglądarce — nie wymaga serwera.

---

## 📖 Jak zacząć

1. Otwórz aplikację — pojawi się strona powitalna
2. Wybierz **✨ Utwórz nowy plan** i przejdź przez kreator (6 kroków)
3. Wypełniaj plan klikając komórki w tabeli
4. Regularnie eksportuj kopię zapasową: Menu ☰ → **⬆ Eksportuj JSON**

---

## 🔒 Prywatność i dane

Aplikacja nie zbiera, nie wysyła ani nie przechowuje żadnych danych zewnętrznie. Wszystkie dane w `localStorage` przeglądarki.

| Klucz | Zawartość |
|-------|-----------|
| `sp_active` | Konfiguracja aktywnego roku |
| `sp_sched` | Wpisy planu zajęć |
| `sp_archive` | Zarchiwizowane lata |
| `sp_vfdates` | Daty „obowiązuje od" |
| `sp_theme` | Wybrany motyw |
| `sp_pwa_dismissed` | Stan banera instalacji PWA |
| `sp_wiz_draft` | Autosave kreatora |
| `sp_cookies_accepted` | Potwierdzenie informacji o danych |

---

## 🗂 Struktura repozytorium

```
Plan-sal/
├── index.html      # Cała aplikacja (HTML + CSS + JS)
├── manifest.json   # PWA manifest
├── sw.js           # Service Worker
├── icon-*.png      # Ikony (72–512 px)
├── LICENSE         # Licencja
└── README.md       # Dokumentacja
```

---

## 🛠 Technologie

Czysty HTML + CSS + JavaScript — zero zewnętrznych zależności. Dane: localStorage. Offline: Service Worker (Cache API). Standard: PWA (Web App Manifest).

---

## 🆕 Co nowego

### v1.1.0 — 31 marca 2026

- Naprawiono crash kreatora przy przejściu do kroku 5 (przypisania sal)
- Naprawiono import nauczycieli z pliku TXT w kreatorze
- Dodano brakującą inicjalizację pól appState dla starszych planów
- Naprawiono zapis daty „obowiązuje od" przy brakującym planie
- Naprawiono czyszczenie starych danych w localStorage przy usuwaniu planu
- Usunięto konfliktujące definicje CSS (duplikaty animacji notyfikacji)
- Poprawiono bezpieczeństwo — dodano escapowanie apostrofów w szablonach HTML
- Dodano numer wersji, datę aktualizacji i sekcję changelog
- Bump Service Worker cache v90 → v91

### v1.0.0 — styczeń 2025

- Pierwsze wydanie aplikacji SalePlan
- Kreator konfiguracji szkoły (6 kroków)
- Plan sal zajęciowych z obsługą budynków, pięter i segmentów
- Wykrywanie kolizji nauczycieli i klas
- Eksport/import JSON, eksport do PDF
- Gospodarz sali z obsługą dwóch wychowawców
- Tryb demo z przykładowymi danymi
- PWA — instalacja na urządzeniu, praca offline
- Motyw jasny i ciemny

---

## ⚖️ Licencja i prawa autorskie

© 2025 Krzysztof Jureczek. Wszelkie prawa zastrzeżone.

Szczegółowe warunki użytkowania w pliku [`LICENSE`](LICENSE). Aplikacja przeznaczona wyłącznie do niekomercyjnego użytku w placówkach oświatowych.
