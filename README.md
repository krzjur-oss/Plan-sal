# 📅 SalePlan — Plan Sal Zajęciowych

Aplikacja PWA do układania i zarządzania planem sal zajęciowych. Działa w całości w przeglądarce — **bez serwera, bez instalacji, bez zbierania danych**. Można ją zainstalować na komputerze lub tablecie jak aplikację natywną.

🔗 **Aplikacja:** https://krzjur-oss.github.io/Plan-sal/

---

## 📦 Wersja

| | |
|---|---|
| **Aktualna wersja** | v2.5.6 |
| **Ostatnia aktualizacja** | 25 kwietnia 2026 |
| **Status** | Aktywny, rozwijany |

---

## ✨ Funkcje

### 🚀 Strona powitalna

Przy pierwszym uruchomieniu wyświetla się strona powitalna z czterema opcjami:

| Opcja | Opis |
|-------|------|
| ✨ Utwórz nowy plan | Kreator od zera — 7 kroków |
| 📋 Nowy rok szkolny | Kopiuje całą konfigurację z bieżącego roku |
| 📂 Importuj z pliku | Wczytaj plan z pliku `.json` |
| 🎬 Wersja demo | Fikcyjna szkoła z przykładowym planem — dane nie są zapisywane |

---

### ☰ Menu nawigacyjne

| Pozycja | Opis |
|---------|------|
| Obowiązuje od | Data obowiązywania planu (osobna dla każdego dnia) |
| 💾 Zapisz | Ręczny zapis do pamięci przeglądarki |
| ↩ Cofnij (Ctrl+Z) | Cofnij ostatnią operację na planie |
| ↪ Przywróć (Ctrl+Y) | Przywróć cofniętą operację |
| ⬇ Eksportuj PDF | Plan gotowy do wydruku (orientacja pozioma) |
| ⬆ Eksportuj JSON | Kopia zapasowa całego planu z archiwum |
| 📊 Eksportuj CSV | Eksport do arkusza kalkulacyjnego — 3 formaty |
| ⬇ Importuj JSON | Wczytaj plan z pliku `.json` |
| ✏️ Edytuj rok | Zmień sale, klasy, nauczycieli, godziny, przedmioty |
| 🗑 Wyczyść dzień | Usuwa wszystkie wpisy bieżącego dnia |
| ❓ Pomoc | Panel z podpowiedziami |
| 🌙 Zmień motyw | Przełącz jasny / ciemny motyw |
| 🏠 Strona główna | Wróć do ekranu startowego |

---

### 🧙 Kreator nowego roku szkolnego (7 kroków)

| Krok | Opis |
|------|------|
| 1 — Szkoła | Nazwa, skrót, telefon, strona www + lista budynków |
| 2 — Rok szkolny | Rok szkolny, numery godzin i **przedziały czasowe** lekcji |
| 3 — Piętra i sale | Piętra, segmenty i numery sal |
| 4 — Klasy i grupy | Lista klas z podziałem na grupy |
| 5 — Przedmioty | Słownik przedmiotów i skrótów do autouzupełniania |
| 6 — Nauczyciele | Lista nauczycieli ze skrótami |
| 7 — Przypisania | Domyślne przypisanie klas do sal |

Kreator automatycznie zapisuje postęp (autosave co 30 s). Menu ☰ → **✏️ Edytuj rok** otwiera kreator z danymi bieżącego roku bez utraty wpisanych zajęć.

---

### 👁 Widok nauczyciela / klasy

Pasek **🏢 Sale / 👤 Nauczyciel / 🏫 Klasa** pod zakładkami dni tygodnia:

- **Widok nauczyciela** — tygodniowy plan wybranego nauczyciela (wiersze = godziny, kolumny = dni)
- **Widok klasy** — tygodniowy plan wybranej klasy lub grupy
- Każda komórka klikalana — otwiera modal edycji w odpowiednim dniu
- Podsumowanie liczby godzin tygodniowo w nagłówku widoku

---

### ↩ Cofnij / Przywróć (Undo / Redo)

- Przyciski **↩** i **↪** w górnym pasku oraz w menu ☰
- Skróty: **Ctrl+Z** — cofnij, **Ctrl+Y** / **Ctrl+Shift+Z** — przywróć
- Stos do 30 operacji: zapis komórki, wyczyszczenie komórki, wyczyszczenie dnia, DnD
- Tooltip na przycisku pokazuje nazwę operacji do cofnięcia

---

### 📚 Słownik przedmiotów

- Definiowany w kreatorze (krok 5) — nazwa + skrót (max 8 znaków)
- Przycisk „Wczytaj predefiniowane" — 23 standardowe polskie przedmioty szkolne
- Skrót generowany automatycznie podczas wpisywania nazwy
- W modalu edycji: **dropdown z autouzupełnianiem** — filtruje po nazwie i skrócie, nawigacja klawiaturą (↑↓ Enter Escape)

---

### 🕐 Przedziały czasowe lekcji

- Definiowane w kreatorze (krok 2) — pole start i koniec dla każdej godziny
- Przycisk „Wypełnij domyślne" — plan 7:00, 45 min lekcja + 10 min przerwa
- Godziny `start–end` wyświetlane pod numerem lekcji w siatce i na wydruku PDF
- Krok opcjonalny — puste pola wyświetlają tylko numer lekcji

---

### 📊 Eksport do CSV

Menu ☰ → **📊 Eksportuj CSV** — trzy warianty:

| Wariant | Opis |
|---------|------|
| 📅 Plan dzienny | Aktywny dzień — kolumny: sale, wiersze: godziny |
| 🗓 Plan tygodniowy | Wszystkie sale × wszystkie dni tygodnia |
| 📋 Zestawienie wpisów | Każdy wpis jako wiersz — do analizy w Excelu / Google Sheets |

Pliki UTF-8 z BOM — Excel otwiera je bez konieczności konwersji znaków.

---

### 📋 Planowanie sal

- Kliknij komórkę aby edytować zajęcia — wybierz nauczyciela, klasę/grupę i wpisz przedmiot
- Pole przedmiotu: **autouzupełnianie** ze słownika + z istniejących wpisów w planie
- Skróty klasy, przedmiotu i inicjały nauczyciela widoczne bezpośrednio w komórce
- **Ctrl+Enter** — zapisz wpis · **Esc** — zamknij okno

---

### 🏫 Obsługa wielu budynków

Dowolna liczba budynków z nazwą i adresem. Każde piętro przypisane do budynku. Nazwy budynków widoczne w scalonych nagłówkach tabeli.

---

### 🎓 Klasy i grupy

- Klasy z opcjonalnym podziałem na grupy
- Kilka klas tego samego poziomu i grupy **automatycznie scala się** w komórce: `4A MN + 4B MN + 4C MN → 4ABC MN`
- Grupy różnych klas lub różnych poziomów pozostają osobno

---

### 🖱️ Przeciąganie zajęć

- Przeciągnij wypełnioną komórkę na inną godzinę lub salę — kopiuje wpis
- Aby przenieść: przeciągnij + wyczyść oryginał
- Gdy cel jest zajęty — pojawia się modal potwierdzenia przed nadpisaniem

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

### 🔒 Bezpieczeństwo danych lokalnych

- Aplikacja monitoruje użycie `localStorage` — wskaźnik `💾 XX KB (YY%)` w statusbarze
- Przy przepełnieniu: automatyczne zwolnienie szkicu kreatora i archiwum, następnie modal z przyciskiem eksportu
- Limit przeglądarek: zwykle 5–10 MB na domenę

---

## 📲 PWA — instalacja jako aplikacja

### Chrome / Edge (Windows, Android)
Kliknij baner „Zainstaluj SalePlan" lub ikonę ⊕ w pasku adresu przeglądarki.

### Safari (iOS / macOS)
Udostępnij → **Dodaj do ekranu głównego**

### Po instalacji
- Pełny tryb offline — Service Worker cache'uje wszystkie pliki
- Przy nowej wersji pojawia się zielony baner z przyciskiem **Odśwież teraz**

---

## ⌨️ Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| **Ctrl+Enter** | Zapisz wpis w oknie edycji |
| **Ctrl+Z** | Cofnij ostatnią operację |
| **Ctrl+Y** / **Ctrl+Shift+Z** | Przywróć cofniętą operację |
| **Escape** | Zamknij okno / panel / menu |
| **↑ / ↓** | Nawigacja w liście autouzupełniania przedmiotów |
| **Enter** | Zatwierdź wybraną podpowiedź przedmiotu |

---

## 🚀 Uruchomienie

### GitHub Pages
https://krzjur-oss.github.io/Plan-sal/

### Lokalnie
Otwórz `index.html` bezpośrednio w przeglądarce — nie wymaga serwera.

---

## 📖 Jak zacząć

1. Otwórz aplikację — pojawi się strona powitalna
2. Wybierz **✨ Utwórz nowy plan** i przejdź przez kreator (7 kroków)
3. W kroku 2 zdefiniuj przedziały czasowe lekcji (opcjonalnie)
4. W kroku 5 dodaj słownik przedmiotów lub wczytaj predefiniowane (opcjonalnie)
5. Wypełniaj plan klikając komórki w tabeli — przedmioty podpowiadają się automatycznie
6. Regularnie eksportuj kopię zapasową: Menu ☰ → **⬆ Eksportuj JSON**

---

## 🔒 Prywatność i dane

Aplikacja nie zbiera, nie wysyła ani nie przechowuje żadnych danych zewnętrznie. Wszystkie dane w `localStorage` przeglądarki.

| Klucz | Zawartość |
|-------|-----------|
| `sp_active` | Konfiguracja aktywnego roku (klasy, nauczyciele, przedmioty, timesloty) |
| `sp_sched` | Wpisy planu zajęć |
| `sp_archive` | Zarchiwizowane lata |
| `sp_vfdates` | Daty „obowiązuje od" |
| `sp_theme` | Wybrany motyw |
| `sp_pwa_dismissed` | Stan banera instalacji PWA |
| `sp_wiz_draft` | Autosave kreatora (szkic) |
| `sp_cookies_accepted` | Potwierdzenie informacji o danych |

---

## 🗂 Struktura repozytorium

```
Plan-sal/
├── index.html      # Struktura HTML aplikacji
├── app.js          # Cała logika aplikacji (~3900 linii)
├── styles.css      # Style CSS (~2800 linii)
├── manifest.json   # PWA manifest
├── sw.js           # Service Worker (cache + powiadomienia o aktualizacji)
├── icon-*.png      # Ikony PWA (72–512 px)
├── LICENSE         # Licencja
├── REGULAMIN.md    # Regulamin użytkowania
└── README.md       # Dokumentacja
```

---

## 🛠 Technologie

Czysty HTML + CSS + JavaScript — zero zewnętrznych zależności. Dane: localStorage. Offline: Service Worker (Cache API). Standard: PWA (Web App Manifest).

---

## 🆕 Co nowego

### v2.5.6 — 25 kwietnia 2026

Widok nauczyciela i klasy — skróty sal:

- **Skrót sali zamiast „Sala N" w widoku Nauczyciela i Klasy** — komórki w tabeli wyświetlają teraz pełny skrót sali (np. `0A2` = piętro 0, segment A, sala 2) zamiast samego numeru, co pozwala od razu zlokalizować salę w budynku
- **Tooltopy kolizji (⚠) pokazują skrót sali** — komunikaty o kolizji nauczyciela/klasy używają teraz skrótu zamiast samego numeru sali

---

### v2.5.5 — 25 kwietnia 2026

Naprawki archiwum i statusbaru:

- **Naprawiono uszkodzenie archiwum przy przywracaniu roku** — zapis bieżącego `appState` do archiwum używał referencji zamiast `structuredClone()`; kolejna linia kodu nadpisywała `appState`, niszcząc jednocześnie właśnie zarchiwizowany config
- **Naprawiono licznik wpisów w statusbarze** — wpisy z tablicą `classes[]` bez pola `className` nie były wliczane do licznika „N wpisów w tym dniu" (ten sam wzorzec co BUG-4 w `detectCollisions`)

---

### v2.5.4 — 25 kwietnia 2026

Naprawki kreatora i PWA:

- **Naprawiono brak listy nauczycieli na kroku 5 kreatora** — `renderTeacherList()` nie była wywoływana przy wejściu na krok Nauczyciele; lista była pusta mimo istniejących danych w drafcie lub edycji roku
- **Naprawiono sortowanie godzin lekcyjnych** — godziny wpisane w dowolnej kolejności (np. `1,0,3,2`) były zapisywane dosłownie; poprawiono w `finishWizard`, `initTimeslotEditor` i `fillTimeslotsDefault`
- **Naprawiono unhandled rejection w instalacji PWA** — dodano `.catch()` do `_pwaPrompt.userChoice`
- Poprawiono formatowanie `.catch()` w `sw.js`

---

### v2.5.3 — 25 kwietnia 2026

Naprawki kreatora i importu:

- **Naprawiono kolejność kroków kreatora** — krok 6 (Nauczyciele) i 7 (Przypisania klas do sal) miały zamienione ID paneli HTML (`wStep5`/`wStep6`); użytkownik widział złą treść na złym kroku
- **Naprawiono import JSON ze starszych plików** — wczytanie pliku bez pola `buildings`, `subjects`, `timeslots` lub brakującego `buildingIdx` na piętrach mogło crashować aplikację po imporcie; dodano funkcję `normalizeAppState()` stosowaną we wszystkich ścieżkach importu (fresh load, merge, overwrite)
- Uproszczono logikę normalizacji — jedna spójna funkcja zamiast rozproszonych warunków `if (!appState.X)`

---

### v2.5.2 — 25 kwietnia 2026

Naprawki błędów:

- **Naprawiono wykrywanie kolizji klas** — wpisy z tablicą `classes[]` bez pola `className` były pomijane w detekcji kolizji (`detectCollisions`); klasy przypisane nowym formatem danych są teraz poprawnie wykrywane
- **System migracji wersji pliku importu** — aplikacja automatycznie aktualizuje strukturę plików JSON ze starszych wersji; plik nowszy niż aplikacja generuje ostrzeżenie w konsoli zamiast cichego błędu
- **Optymalizacja wydajności** — zastąpiono wszystkie 29 wywołań `JSON.parse(JSON.stringify(…))` natywnymi `structuredClone()` — szybszy deep clone, poprawna obsługa typów Date/Map/Set

---

### v2.5.1 — 24 kwietnia 2026

Poprawka walidacji sal:

- **Duplikat = ten sam skrót piętro+segment+nr** — Sala 1 w Seg A i Sala 1 w Seg B są dozwolone (różne skróty: `0A1`, `0B1`)
- Komunikat błędu pokazuje pełny skrót sali (np. `0A1`) zamiast samego numeru
- Przycisk „＋ sala" wróca do numeracji per-segment

---

### v2.5.0 — 24 kwietnia 2026

Przeprojektowany kreator — krok „Budynek":

- **Piętra pogrupowane pod budynkami** — każdy budynek to oddzielna sekcja z własnym przyciskiem „＋ Dodaj piętro"
- Nowy budynek (np. hala sportowa) pokazuje pustą kartę z wyraźnym komunikatem zamiast dezorientującego dropdownu
- Dodanie piętra do konkretnego budynku poprzez przycisk w nagłówku sekcji
- Usunięto dropdown „przynależność do budynku" z kart pięter (był przyczyną zamieszania)

---

### v2.4.1 — 23 kwietnia 2026

Poprawki unikalności numerów sal:

- **Walidacja globalna** — duplikat numeru sali wykrywany w całej szkole, nie tylko w segmencie
- Komunikat błędu wskazuje dokładnie gdzie powtarza się numer (piętro i segment)
- **Podświetlanie duplikatów w czasie rzeczywistym** — czerwone obramowanie przy wpisywaniu
- Przycisk „＋ sala" generuje globalnie unikalny numer automatycznie

---

### v2.4.0 — 23 kwietnia 2026

Nowa funkcja — migracja struktury budynków:

- **Migracja kluczy sal po zmianie struktury budynków** — dodanie nowego budynku (np. hali sportowej) lub zmiana układu pięter w połowie roku nie powoduje utraty danych w planie lekcji
- Sale identyfikowane są po numerze, nie po pozycji — wpisy automatycznie przepisywane do nowych kluczy
- Po zamknięciu kreatora wyświetlana jest informacja o liczbie zaktualizowanych wpisów

---

### v2.3.1 — 23 kwietnia 2026

Poprawki panelu ustawień:

- Zakładka **Klasy** — sortowanie alfabetyczne po nazwie i grupie; przycisk „Dodaj klasę" na górze listy
- Zakładka **Nauczyciele** — naprawiono focus przy dodawaniu (kursor trafia do nowego wiersza, nie ostatniego istniejącego)
- Zakładka **Przedmioty** — sortowanie alfabetyczne; przycisk „Dodaj przedmiot" na górze listy

---

### v2.3.0 — 23 kwietnia 2026

Nowa funkcja — Panel Ustawień Szkoły:

- **⚙️ Panel Ustawień Szkoły** — przycisk w topbarze i menu ☰, panel wysuwa się z prawej strony
- Zakładka **Klasy** — dodawanie, edycja nazwy/skrótu/grupy/klasy bazowej inline; zmiana skrótu kaskadowo aktualizuje cały plan
- Zakładka **Nauczyciele** — edycja imienia, nazwiska i skrótu; zmiana skrótu aktualizuje wszystkie wpisy w planie
- Zakładka **Przedmioty** — zarządzanie listą przedmiotów używanych w podpowiedziach
- Zakładka **Godziny** — dodawanie/usuwanie godzin lekcyjnych, edycja czasów rozpoczęcia i zakończenia
- Zakładka **Sale** — podgląd drzewa pięter/segmentów/sal z linkiem do kreatora
- Znacznik **„w planie"** przy elementach używanych w aktywnym planie
- Potwierdzenie przed usunięciem elementów używanych w planie

---

### v2.2.0 — 23 kwietnia 2026

Nowa funkcja — klasa bazowa:

- **Pole „klasa bazowa"** w kreatorze i ustawieniach — jawne przypisanie podgrupy do klasy nadrzędnej (np. `1A-religia` → `1A`)
- Widok **„Klasa"** agreguje wszystkie podgrupy — jedna tabela pokazuje zajęcia całej klasy i równoległych grup
- Dropdown filtra widoku pokazuje klasy bazowe z licznikiem podgrup (np. `1A (+2 gr.)`)
- Automatyczna migracja starych danych — pole `baseClass: ''` dodawane bez utraty wpisów

---

### v2.1.0 — 23 kwietnia 2026

Wydanie naprawcze — 7 poprawek błędów i 1 optymalizacja:

- **🔴 Naprawiono crash Undo cross-day** — funkcja `renderDayTabs()` nie istniała; zastąpiona poprawnym `switchDay()`
- **🔴 Naprawiono wymuszone przeładowanie strony** — duplikat handlera `SW_UPDATED` w `index.html` powodował `window.location.reload()` bez zgody użytkownika, omijając baner z wyborem
- **🔴 Naprawiono edycję roku szkolnego** — flaga `_wizardEditMode` była kasowana przed własnym sprawdzeniem, co resetowało aktywny dzień do poniedziałku po każdej edycji
- **🟠 Naprawiono etykiety historii Undo** — `_mHour + 1` zwracał konkatenację stringów zamiast liczby (np. „godz. 31" zamiast „godz. 3")
- **🟠 Naprawiono widok nauczyciela/klasy** — kliknięcie pustej komórki otwierało zepsuty modal z pustym kluczem; teraz wyświetlany jest tooltip informacyjny
- **🟠 Naprawiono wybór klasy w przypisaniach** — `String.replace()` mogło zaznaczać błędną opcję gdy `saved = ''`; zastąpione przez dedykowaną funkcję `buildClassOptions()`
- **🟡 Naprawiono walidację importu** — `handleImportFile` odrzucał pliki zawierające tylko `appState` bez `schedData`; ujednolicone z `welcomeHandleFile`
- **⚡ Optymalizacja** — `flattenColumns()` memoizowana: wynik cache'owany do czasu zmiany struktury pięter, eliminując zbędne przebudowy tablicy kolumn przy każdym renderze
- Bump Service Worker cache `sp-v92` → `sp-v93`

---

### v2.0.0 — 22 kwietnia 2026

Osiem nowych usprawnień:

- **💾 Obsługa przepełnienia localStorage** — strategia ratunkowa (szkic → archiwum → modal), wskaźnik użycia `💾 XX KB (YY%)` w statusbarze, zmiana koloru przy >65% i >85%
- **↩ Undo / Redo** — stos do 30 operacji; Ctrl+Z / Ctrl+Y; przyciski ↩ ↪ w topbarze i menu ☰; tooltip z nazwą cofanej operacji
- **👁 Widok nauczyciela / klasy** — pasek przełącznika 🏢/👤/🏫 pod zakładkami; tygodniowa tabela godziny × dni; filtr z listą wyboru; licznik godzin
- **📚 Słownik przedmiotów** — krok 5 kreatora; 23 predefiniowane przedmioty; autoskróty; dropdown z autouzupełnianiem w modalu edycji (klawiatura: ↑↓ Enter Esc)
- **🪟 Modalne potwierdzenia** — 7 wywołań `window.confirm()` zastąpione spójnym modalem (Enter/Escape, danger/neutral)
- **🕐 Przedziały czasowe lekcji** — edytor w kroku 2 kreatora; domyślny plan 7:00; godziny `start–end` w siatce i na wydruku
- **🔄 Listener SW** — 3 ścieżki (`postMessage`, `updatefound`, `controllerchange`); baner aktualizacji z przyciskiem „Odśwież teraz"
- **📊 Eksport CSV** — 3 warianty: dzienny, tygodniowy, zestawienie płaskie; UTF-8 z BOM; timesloty w kolumnie „Czas"
- Kreator rozszerzony z 6 do **7 kroków**

---

### v1.2.0 — 7 kwietnia 2026

- Naprawiono crash przycisku zamknięcia banera PWA (`dismissPWAInstall` → `pwaDismiss`)
- Naprawiono zakładki przypisań sal — używały `DAYS_DEFAULT` zamiast `appState.days`
- Dodano `FileReader.onerror` do trzech funkcji (`welcomeHandleFile`, `handleImportFile`, `readFloorTxtFile`)
- Naprawiono mylące łamanie linii przed operatorem `?` w `detectCollisions`
- Przekonwertowano `<a>` bez `href` na `<button>` — lepsza dostępność
- Usunięto zduplikowaną deklarację CSS `display:none` w `#pwaInstallBanner`
- Usunięto pustą regułę CSS `.pdf-day`
- Dodano `defer` do wczytywania `app.js` — poprawiona kolejność inicjalizacji DOM

---

### v1.1.0 — 31 marca 2026

- Naprawiono crash kreatora przy przejściu do kroku 5 (przypisania sal)
- Naprawiono import nauczycieli z pliku TXT w kreatorze
- Dodano brakującą inicjalizację pól appState dla starszych planów
- Naprawiono zapis daty „obowiązuje od" przy brakującym planie
- Naprawiono czyszczenie starych danych w localStorage przy usuwaniu planu
- Usunięto konfliktujące definicje CSS (duplikaty animacji notyfikacji)
- Poprawiono bezpieczeństwo — dodano escapowanie apostrofów w szablonach HTML
- Bump Service Worker cache v90 → v91

---

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
