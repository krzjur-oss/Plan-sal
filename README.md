# 📅 SalePlan — Plan Sal Zajęciowych

Aplikacja webowa do układania i zarządzania planem sal zajęciowych. Zawiera **kreator konfiguracji**, **archiwum lat szkolnych** i eksport do PDF. Działa w całości w przeglądarce — bez serwera, bez instalacji, bez zbierania danych.

---

## ✨ Funkcje

### 🧙 Kreator nowego roku szkolnego
- Definiowanie **pięter i stref** budynku (dowolna liczba)
- Dodawanie **segmentów** i **numerów sal** z opisem
- Lista **klas** uczestniczących w planie
- **Przypisanie klas do sal** dla każdego dnia tygodnia osobno
- Konfiguracja **godzin lekcyjnych** i roku szkolnego

### 📋 Planowanie sal
- Interaktywna siatka: godziny × sale
- Każda komórka: **nauczyciel**, **przedmiot**, **uwagi**
- Kolorowe oznaczenie pięter w nagłówkach
- Przypisane klasy widoczne w nagłówkach kolumn
- Data „Obowiązuje od" dla każdego dnia
- Eksport do **PDF** (orientacja pozioma)

### 📁 Archiwum
- Każdy nowy rok szkolny **archiwizuje poprzedni**
- Dostęp do starych planów i ich **przywracanie**
- Usuwanie zbędnych archiwów

---

## 🔒 Prywatność i dane

> **Aplikacja nie zbiera, nie wysyła ani nie przechowuje żadnych danych zewnętrznie.**

Wszystkie dane przechowywane są lokalnie w `localStorage` przeglądarki. Jedyne zewnętrzne połączenie to pobranie czcionek z **Google Fonts** (można wyłączyć edytując `index.html`).

---

## 🚀 Uruchomienie

### Lokalnie
Otwórz plik `index.html` w przeglądarce — bez żadnej instalacji.

### GitHub Pages
1. Wgraj repozytorium na GitHub
2. **Settings → Pages → Deploy from branch → main → / (root)**
3. Dostępne pod: **(https://krzjur-oss.github.io/Plan-sal/)**

---

## 📖 Jak zacząć

1. **Pierwsze uruchomienie** → automatycznie otwiera się kreator
2. Przejdź przez 4 kroki: rok szkolny → budynek → klasy → przypisania
3. Kliknij **„Zakończ i przejdź do planu"**
4. Klikaj komórki w tabeli, żeby wpisywać nauczycieli i przedmioty
5. Naciśnij **💾 Zapisz** — dane zostają w przeglądarce

**Nowy rok szkolny:** przycisk **＋ Nowy rok** w górnym pasku → kreator → stary rok trafia do archiwum.

---

## ⌨️ Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| `Ctrl + Enter` | Zapisz wpis w oknie edycji |
| `Escape` | Zamknij okno |

---

## 🗂 Struktura repozytorium

```
/
├── index.html   ← cała aplikacja (jeden plik HTML)
└── README.md    ← ten plik
```

---

## 🛠 Technologie

- Czysty HTML + CSS + JavaScript (zero zależności)
- Dane: `localStorage` przeglądarki
- Czcionki: Google Fonts (Outfit + JetBrains Mono)

---

## 📄 Licencja

Do użytku wewnętrznego szkoły.
